import { createHmac } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client";
import type { BusinessRow } from "../db/schema";
import { env } from "../env";
import { newId } from "../ids";
import { log } from "../log";
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

/** Distinct reporters within 24 h that pause a business's checkout until a person reviews it. */
export const AUTO_HOLD_REPORTERS = 3;
const REPORTS_PER_REPORTER_PER_DAY = 5;

/** Reporter identity without storing the IP: HMAC(secret, ip + UTC day). */
export function reporterId(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "unknown";
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
    await setBusinessStatus(b, "suspended", `held after ${distinct!.n} reports in 24 hours`, "reports");
    held = true;
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
  const [row] = await d.update(schema.businesses).set({ status, updatedAt: new Date() }).where(eq(schema.businesses.id, b.id)).returning();
  await d.insert(schema.events).values({ id: newId("evt"), type: "moderation", slug: b.slug, name: b.name, data: { action: to, status, reason, by } });
  log.warn("business status changed", { slug: b.slug, status, by, reason });
  return row!;
}
