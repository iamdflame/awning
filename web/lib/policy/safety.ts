import { createHmac } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { adapters } from "../adapters";
import { db, schema } from "../db/client";
import type { BusinessRow, Provisioning } from "../db/schema";
import { env } from "../env";
import { newId } from "../ids";
import { errorMessage, log } from "../log";
import { alertOperator } from "../ops/alert";
import type { PolicyResult } from "./screen";

/** Thrown by services when published text breaks the acceptable use policy (→ 422). */
export class PolicyError extends Error {
  constructor(readonly result: Extract<PolicyResult, { ok: false }>) {
    super(result.reason);
  }
}

/** Thrown when a wallet exceeds a per-wallet limit (→ 429). */
export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/**
 * Per-wallet limits. PayBox calls arrive from shared egress IPs, so the owner
 * wallet (which every plan must name) is the unit, not the IP address.
 */
export async function assertPlanQuota(ownerWallet: string) {
  const limit = env.planLimitPerHour();
  const d = await db();
  // Wallet addresses are free to make, so a global ceiling protects drafting and image credit.
  const [all] = await d.select({ n: sql<number>`count(*)::int` }).from(schema.plans).where(gt(schema.plans.createdAt, new Date(Date.now() - HOUR)));
  if ((all?.n ?? 0) >= env.globalPlansPerHour()) {
    throw new RateLimitError("Awning is drafting an unusual number of businesses right now. Try again in a few minutes.", 300);
  }
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.plans)
    .where(and(eq(schema.plans.ownerWallet, ownerWallet), gt(schema.plans.createdAt, new Date(Date.now() - HOUR))));
  if ((row?.n ?? 0) >= limit) {
    throw new RateLimitError(`This wallet has drafted ${limit} businesses in the last hour. Try again later.`, 3600);
  }
}

export async function assertFreeOpenQuota(ownerWallet: string) {
  const limit = env.freeOpensPerDay();
  const d = await db();
  const [all] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.businesses)
    .where(and(eq(schema.businesses.package, "free"), gt(schema.businesses.openedAt, new Date(Date.now() - HOUR))));
  if ((all?.n ?? 0) >= env.globalFreeOpensPerHour()) {
    throw new RateLimitError("Awning is opening an unusual number of free businesses right now. Try again in a few minutes.", 300);
  }
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.businesses)
    .where(
      and(
        eq(schema.businesses.ownerWallet, ownerWallet),
        eq(schema.businesses.package, "free"),
        gt(schema.businesses.openedAt, new Date(Date.now() - DAY)),
      ),
    );
  if ((row?.n ?? 0) >= limit) {
    throw new RateLimitError(`This wallet has opened ${limit} free businesses in the last 24 hours. Try again tomorrow, or open with a custom domain.`, 86400);
  }
}

// ---------------------------------------------------------------- reports

export const REPORT_REASONS = ["phishing", "impersonation", "scam", "prohibited", "other"] as const;

export const reportSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  contact: z.string().trim().max(200).optional(),
});

/** Distinct reporter networks within 24 h that pause a business's checkout until a person reviews it. */
export const AUTO_HOLD_REPORTERS = 3;
/**
 * Automatic holds are for new or barely used businesses, where phishing lives. An established
 * business (open for 14 days with 3+ sales) is never taken down by reports alone: a person is paged.
 */
const ESTABLISHED_AGE_MS = 14 * 24 * 3600_000;
const ESTABLISHED_SALES = 3;

export function isEstablished(b: Pick<BusinessRow, "openedAt" | "salesCount">, now = Date.now()): boolean {
  return !!b.openedAt && now - new Date(b.openedAt).getTime() >= ESTABLISHED_AGE_MS && b.salesCount >= ESTABLISHED_SALES;
}
const REPORTS_PER_REPORTER_PER_DAY = 5;

/** The reporter's network, not their address: IPv4 /24, IPv6 /48. Three reports from one network count once. */
export function reporterNetwork(ip: string): string {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) return `${ip.toLowerCase().split(":").slice(0, 3).join(":")}::/48`;
  return ip || "unknown";
}

/** Reporter identity without storing the IP: HMAC(secret, network + UTC day). */
export function reporterId(req: Request): string {
  const ip = reporterNetwork((req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "unknown");
  const day = new Date().toISOString().slice(0, 10);
  const secret = env.ownerTokenSecret() ?? "awning-dev-report-salt";
  return createHmac("sha256", secret).update(`report:${ip}:${day}`).digest("base64url").slice(0, 22);
}

export type ReportOutcome =
  | { status: "received"; held: boolean; reportId: string }
  | { status: "rate_limited" }
  | { status: "not_found" };

export async function fileReport(input: z.infer<typeof reportSchema>, reporter: string): Promise<ReportOutcome> {
  const d = await db();
  const [b] = await d.select().from(schema.businesses).where(eq(schema.businesses.slug, input.slug.toLowerCase())).limit(1);
  if (!b) return { status: "not_found" };

  const since = new Date(Date.now() - DAY);
  const [mine] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.events)
    .where(and(eq(schema.events.type, "report"), gt(schema.events.at, since), sql`${schema.events.data}->>'reporter' = ${reporter}`));
  if ((mine?.n ?? 0) >= REPORTS_PER_REPORTER_PER_DAY) return { status: "rate_limited" };

  const reportId = newId("rpt");
  await d.insert(schema.events).values({
    id: reportId,
    type: "report",
    slug: b.slug,
    name: b.name,
    data: { reason: input.reason, details: input.details ?? null, contact: input.contact ?? null, reporter },
  });
  log.warn("business reported", { slug: b.slug, reason: input.reason, reportId });

  const [distinct] = await d
    .select({ n: sql<number>`count(distinct ${schema.events.data}->>'reporter')::int` })
    .from(schema.events)
    .where(and(eq(schema.events.type, "report"), eq(schema.events.slug, b.slug), gt(schema.events.at, since)));
  let held = b.status === "suspended";
  if (!held && (distinct?.n ?? 0) >= AUTO_HOLD_REPORTERS) {
    if (isEstablished(b)) {
      await alertOperator("reports against an established business: review", { slug: b.slug, reporters: distinct!.n, reason: input.reason });
    } else {
      await setBusinessStatus(b, "suspended", `held after ${distinct!.n} reports in 24 hours`, "reports");
      await alertOperator("business held after reports: review", { slug: b.slug, reporters: distinct!.n, reason: input.reason });
      held = true;
    }
  }
  return { status: "received", held, reportId };
}

/**
 * Suspend (checkout paused, storefront shows it is unavailable, delisted) or
 * restore a business. Restoring returns it to live only if it had opened.
 */
export async function setBusinessStatus(b: BusinessRow, to: "suspended" | "restored", reason: string, by: "reports" | "admin") {
  const d = await db();
  const status = to === "suspended" ? "suspended" : b.openedAt ? "live" : "draft";
  const provisioning = await togglePhoneAgent(b, to);
  const [row] = await d.update(schema.businesses).set({ status, provisioning, updatedAt: new Date() }).where(eq(schema.businesses.id, b.id)).returning();
  await d.insert(schema.events).values({ id: newId("evt"), type: "moderation", slug: b.slug, name: b.name, data: { action: to, status, reason, by } });
  log.warn("business status changed", { slug: b.slug, status, by, reason });
  return row!;
}

/**
 * A suspended business must stop answering its phone as well: detach the number from
 * the AI receptionist (the agent itself is kept) and re-attach it on restore. Best effort:
 * a provider error is logged for the operator and never blocks the takedown.
 */
async function togglePhoneAgent(b: BusinessRow, to: "suspended" | "restored"): Promise<Provisioning> {
  const prov: Provisioning = { ...b.provisioning };
  const receptionist = adapters().receptionist;
  try {
    if (to === "suspended" && prov.receptionistPhoneId) {
      await receptionist.remove({ phoneId: prov.receptionistPhoneId });
      prov.receptionistPhoneId = undefined;
    } else if (to === "restored" && prov.receptionistAgentId && !prov.receptionistPhoneId && b.phone) {
      const { phoneId } = await receptionist.attachNumber({ agentId: prov.receptionistAgentId, number: b.phone, label: b.name });
      prov.receptionistPhoneId = phoneId;
    }
  } catch (err) {
    await alertOperator("could not toggle the phone agent", { slug: b.slug, to, error: errorMessage(err) });
  }
  return prov;
}
