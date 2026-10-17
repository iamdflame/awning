import { and, eq, lt, or } from "drizzle-orm";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";
import { adapters } from "../adapters";
import { apiError, apiUrl, json, ownerTokenFor } from "../api";
import { db, schema } from "../db/client";
import type { BusinessRow, PlanDomain, PlanRow, Provisioning, StepRecord } from "../db/schema";
import { businessUrl, env } from "../env";
import { errorMessage, log } from "../log";
import { atomicToUsd, PRO_FEE_ATOMIC } from "../money";
import { runSaga, type Step } from "../orchestrator/machine";
import { MAX_TIMEOUT_SECONDS } from "../x402/constants";
import { handlePaidRequest, type SettleInfo, type WorkResult } from "../x402/flow";
import type { Charge } from "../x402/seller";
import { getBusinessById } from "./businesses";
import { emitEvent } from "./events";
import { getPlan } from "./plans";

export const openBodySchema = z.object({
  domain: z.string().trim().toLowerCase().max(253).optional(),
  package: z.enum(["pro"]).optional(),
});

function openedBusinessView(b: BusinessRow) {
  return { slug: b.slug, name: b.name, url: businessUrl(b), domain: b.package === "pro" ? b.domain : null, phone: b.phone, status: b.status, package: b.package };
}

function treasury(): string | null {
  const t = env.treasuryAddress();
  return t && isAddress(t) && t !== zeroAddress ? getAddress(t) : null;
}

type OpenQuote = { plan: PlanRow; business: BusinessRow; domain: PlanDomain; charge: Charge; quote: Record<string, unknown> };

/** Resolve and validate what an open request would cost. Pure reads; no writes. */
export async function quoteOpen(planId: string, body: z.infer<typeof openBodySchema>, url: URL, paid: boolean): Promise<OpenQuote | Response> {
  const plan = await getPlan(planId);
  if (!plan) return apiError(404, "plan_not_found", `No plan ${planId}`);
  const business = await getBusinessById(plan.businessId);
  if (!business) return apiError(404, "plan_not_found", `Plan ${planId} has no business`);
  const payTo = treasury();
  if (!payTo) return apiError(503, "misconfigured", "AWNING_TREASURY_ADDRESS is not configured");

  const alreadyPro = plan.status === "opened" && plan.openPackage === "pro";
  const wanted = (alreadyPro ? plan.openDomain : null) ?? body.domain ?? url.searchParams.get("domain")?.toLowerCase() ?? plan.recommendedDomain;
  if (!wanted) return apiError(409, "no_domain_available", "None of this plan's domains is available. Create a new plan or open for free.");
  const domain = plan.domains.find((d) => d.domain === wanted);
  if (!domain) return apiError(400, "domain_not_offered", `${wanted} is not one of this plan's domains`, { domains: plan.domains.map((d) => d.domain) });
  if (!domain.available) return apiError(409, "domain_unavailable", `${wanted} is not available; choose another domain from the plan`);

  if (alreadyPro && !paid) {
    return json({ error: "already_open", message: `${business.name} is already open.`, business: openedBusinessView(business) }, { status: 409 });
  }
  if (!alreadyPro) {
    const graceMs = paid ? MAX_TIMEOUT_SECONDS * 1000 : 0;
    if (Date.now() > plan.expiresAt.getTime() + graceMs) {
      return apiError(410, "quote_expired", "This plan's quote has expired. Create a new plan to get a fresh price.", { expiresAt: plan.expiresAt.toISOString() });
    }
  }

  const amountAtomic = BigInt(domain.totalAtomic);
  const charge: Charge = {
    amountAtomic,
    payTo,
    resourceUrl: apiUrl(`/x402/open/${plan.id}`),
    description: `Open ${business.name} on ${domain.domain} (Awning Pro)`,
  };
  const quote = {
    planId: plan.id,
    business: business.name,
    domain: domain.domain,
    package: "pro",
    totalUsd: atomicToUsd(amountAtomic),
    breakdown: { domainUsd: atomicToUsd(BigInt(domain.priceAtomic)), serviceUsd: atomicToUsd(PRO_FEE_ATOMIC) },
    expiresAt: plan.expiresAt.toISOString(),
    guarantee: "You are charged only if the business opens. If anything fails, the payment is never settled.",
  };
  return { plan, business, domain, charge, quote };
}

type OpenState = {
  plan: PlanRow;
  business: BusinessRow;
  domain: PlanDomain;
  prov: Provisioning;
};

function proSteps(): Step<OpenState>[] {
  const a = adapters();
  return [
    {
      name: "preflight",
      timeoutMs: 6000,
      run: async (s, signal) => {
        const [c] = await a.registrar.check([s.domain.domain], signal);
        if (!c || !c.available) throw new Error(`${s.domain.domain} is no longer available`);
        if (c.cents !== s.domain.registrarCents) throw new Error(`price changed: quoted ${s.domain.registrarCents}¢, now ${c.cents}¢`);
      },
    },
    {
      name: "phone",
      timeoutMs: 9000,
      run: async (s, signal) => {
        const n = await a.telephony.buy(
          {
            country: s.plan.prepared.phone.country,
            candidates: s.plan.prepared.phone.candidates,
            friendlyName: `Awning: ${s.business.name}`,
            voiceUrl: apiUrl(`/v1/voice/${s.business.slug}`),
          },
          signal,
        );
        s.prov.phoneSid = n.sid;
        s.prov.phoneNumber = n.number;
        s.prov.phoneMock = a.telephony.mock;
      },
      undo: async (s, signal) => {
        if (s.prov.phoneSid) await a.telephony.release(s.prov.phoneSid, signal);
      },
    },
    {
      name: "receptionist",
      timeoutMs: 9000,
      run: async (s, signal) => {
        const r = s.plan.prepared.receptionist;
        const { agentId } = await a.receptionist.create({ businessName: s.business.name, agentName: r.agentName, systemPrompt: r.systemPrompt, firstMessage: r.firstMessage }, signal);
        s.prov.receptionistAgentId = agentId;
      },
      undo: async (s, signal) => {
        if (s.prov.receptionistAgentId) await a.receptionist.remove({ agentId: s.prov.receptionistAgentId }, signal);
      },
    },
    {
      name: "connect_phone",
      timeoutMs: 9000,
      // A mock number cannot be imported into a real voice provider and vice versa.
      when: () => !a.telephony.mock && !a.receptionist.mock,
      run: async (s, signal) => {
        const { phoneId } = await a.receptionist.attachNumber({ agentId: s.prov.receptionistAgentId!, number: s.prov.phoneNumber!, label: s.business.name }, signal);
        s.prov.receptionistPhoneId = phoneId;
      },
      undo: async (s, signal) => {
        if (s.prov.receptionistPhoneId) await a.receptionist.remove({ phoneId: s.prov.receptionistPhoneId }, signal);
      },
    },
    {
      name: "hosting",
      timeoutMs: 8000,
      run: async (s, signal) => {
        const { names } = await a.hosting.addDomain(s.domain.domain, signal);
        s.prov.hostingDomains = names;
      },
      undo: async (s, signal) => {
        if (s.prov.hostingDomains?.length) await a.hosting.removeDomains(s.prov.hostingDomains, signal);
      },
    },
    {
      // Irreversible and costly: last of the provider steps.
      name: "register_domain",
      timeoutMs: 15000,
      run: async (s, signal) => {
        const r = await a.registrar.register(s.domain.domain, s.domain.registrarCents, `awning-open-${s.plan.id}-${s.domain.domain}`, signal);
        s.prov.registrarOrderId = r.orderId;
      },
    },
    {
      name: "dns",
      timeoutMs: 8000,
      retries: 1,
      run: async (s, signal) => {
        const { ids } = await a.registrar.setDns(s.domain.domain, s.plan.prepared.dns, `awning-dns-${s.plan.id}`, signal);
        s.prov.dnsRecordIds = ids;
      },
    },
  ];
}

function mocksInUse(): string[] {
  const a = adapters();
  return (Object.entries(a) as [string, { mock: boolean }][]).filter(([, v]) => v.mock).map(([k]) => k);
}

/** POST /x402/open/:planId — x402-paid Pro open, idempotent by plan. */
export async function openPro(req: Request, planId: string, body: z.infer<typeof openBodySchema>): Promise<Response> {
  const paid = !!(req.headers.get("payment-signature") || req.headers.get("x-payment"));
  const q = await quoteOpen(planId, body, new URL(req.url), paid);
  if (q instanceof Response) return q;
  const { plan, business, domain, charge, quote } = q;

  return handlePaidRequest({
    req,
    charge,
    purpose: "open",
    refId: plan.id,
    quote,
    refundable: true,
    work: async (ctx): Promise<WorkResult> => {
      const d = await db();
      const staleBefore = new Date(Date.now() - 3 * 60 * 1000);
      const claimed = await d
        .update(schema.plans)
        .set({ status: "opening", openPaymentKey: ctx.key, openDomain: domain.domain, updatedAt: new Date() })
        .where(
          and(
            eq(schema.plans.id, plan.id),
            or(
              eq(schema.plans.status, "quoted"),
              and(eq(schema.plans.status, "opened"), eq(schema.plans.openPackage, "free")),
              and(eq(schema.plans.status, "opening"), lt(schema.plans.updatedAt, staleBefore)),
            ),
          ),
        )
        .returning();

      if (!claimed.length) {
        const current = await getPlan(plan.id);
        const b = (await getBusinessById(plan.businessId)) ?? business;
        if (current?.status === "opened" && current.openPackage === "pro") {
          // Already open: never charge twice. The original payer (proven by
          // this verified signature) may recover the owner token.
          const [orig] = current.openPaymentKey
            ? await d.select().from(schema.payments).where(eq(schema.payments.key, current.openPaymentKey)).limit(1)
            : [];
          const samePayer = !!orig && orig.payer === ctx.payer;
          return {
            ok: "skip",
            status: 200,
            body: {
              alreadyOpen: true,
              charged: false,
              business: openedBusinessView(b),
              ...(samePayer ? { ownerToken: ownerTokenFor(b.id, b.ownerTokenVersion) } : {}),
              receipts: { paidUsd: orig ? atomicToUsd(orig.amountAtomic) : null, tx: orig?.tx ?? null },
              message: "This business is already open. This payment was not settled; you were not charged again.",
            },
          };
        }
        return { ok: false, status: 409, body: { error: "open_in_progress", message: "This plan is being opened by another payment. You were not charged; check the plan status shortly.", charged: false, refunded: false } };
      }

      const restoreStatus = business.status === "live" ? ("opened" as const) : ("quoted" as const);
      const release = async (steps: StepRecord[], reason: string) => {
        await d
          .update(schema.plans)
          .set({ status: restoreStatus, openPaymentKey: null, openDomain: restoreStatus === "opened" ? plan.openDomain : null, openSteps: steps, lastError: reason.slice(0, 500), updatedAt: new Date() })
          .where(and(eq(schema.plans.id, plan.id), eq(schema.plans.openPaymentKey, ctx.key)));
      };

      const state: OpenState = { plan: claimed[0]!, business, domain, prov: { ...business.provisioning } };
      const saga = await runSaga(proSteps(), state, { deadlineMs: env.openDeadlineMs(), label: `open ${plan.id}` });
      if (!saga.ok) {
        await release(saga.steps, `${saga.failedStep}: ${saga.reason}`);
        return {
          ok: false,
          status: 502,
          body: {
            error: "provisioning_failed",
            message: `Could not open ${business.name}: ${saga.failedStep} failed (${saga.reason}). The payment was not settled — you were not charged.`,
            reason: saga.reason,
            failedStep: saga.failedStep,
            charged: false,
            refunded: false,
            steps: saga.steps.map(({ name, status, ms }) => ({ name, status, ms })),
          },
        };
      }

      return {
        ok: true,
        compensate: async (reason) => {
          const steps = await saga.undo();
          await release(steps, reason);
        },
        commit: async (s: SettleInfo) => {
          const t0 = performance.now();
          const now = new Date();
          const mocks = mocksInUse();
          const [live] = await d
            .update(schema.businesses)
            .set({
              status: "live",
              package: "pro",
              domain: domain.domain,
              phone: state.prov.phoneNumber ?? null,
              provisioning: { ...state.prov, mocks },
              openedAt: business.openedAt ?? now,
              updatedAt: now,
            })
            .where(eq(schema.businesses.id, business.id))
            .returning();
          if (!live) throw new Error("business row vanished");
          const steps: StepRecord[] = [...saga.steps, { name: "go_live", status: "ok", ms: Math.round(performance.now() - t0) }];
          await d
            .update(schema.plans)
            .set({ status: "opened", openPackage: "pro", openSteps: steps, lastError: null, updatedAt: now })
            .where(and(eq(schema.plans.id, plan.id), eq(schema.plans.openPaymentKey, ctx.key)));
          await emitEvent({ type: "opened", slug: live.slug, name: live.name, amountAtomic: charge.amountAtomic, tx: s.tx, data: { package: "pro", domain: domain.domain } }).catch((err) =>
            log.warn("event emit failed", { error: errorMessage(err) }),
          );
          return {
            status: 200,
            body: {
              business: openedBusinessView(live),
              ownerToken: ownerTokenFor(live.id, live.ownerTokenVersion),
              receipts: { paidUsd: atomicToUsd(charge.amountAtomic), tx: s.tx, payer: s.payer, network: s.network, settlement: s.confirmed ? "confirmed" : "unconfirmed" },
              steps: steps.map(({ name, status, ms }) => ({ name, status, ms })),
              ...(mocks.length ? { simulated: mocks } : {}),
            },
          };
        },
      };
    },
  });
}

/** POST /v1/open-free — free subdomain open. No money; idempotent by plan. */
export async function openFree(planId: string): Promise<Response> {
  const t0 = performance.now();
  const plan = await getPlan(planId);
  if (!plan) return apiError(404, "plan_not_found", `No plan ${planId}`);
  const business = await getBusinessById(plan.businessId);
  if (!business) return apiError(404, "plan_not_found", `Plan ${planId} has no business`);

  const already = (b: BusinessRow) =>
    json({ business: openedBusinessView(b), ownerToken: ownerTokenFor(b.id, b.ownerTokenVersion), alreadyOpen: true, steps: [] });

  if (business.status === "live") return already(business);

  const d = await db();
  const claimed = await d
    .update(schema.plans)
    .set({ status: "opened", openPackage: "free", updatedAt: new Date() })
    .where(and(eq(schema.plans.id, plan.id), eq(schema.plans.status, "quoted")))
    .returning();
  if (!claimed.length) {
    const current = await getPlan(plan.id);
    if (current?.status === "opening") return apiError(409, "open_in_progress", "This plan is being opened right now; check back shortly.");
    const b = await getBusinessById(plan.businessId);
    if (b?.status === "live") return already(b);
    return apiError(409, "plan_not_openable", `Plan is ${current?.status ?? "unknown"}`);
  }
  const now = new Date();
  const [live] = await d
    .update(schema.businesses)
    .set({ status: "live", package: "free", openedAt: now, updatedAt: now })
    .where(eq(schema.businesses.id, business.id))
    .returning();
  const steps: StepRecord[] = [{ name: "go_live", status: "ok", ms: Math.round(performance.now() - t0) }];
  await d.update(schema.plans).set({ openSteps: steps }).where(eq(schema.plans.id, plan.id));
  await emitEvent({ type: "opened", slug: live!.slug, name: live!.name, amountAtomic: 0n, data: { package: "free" } }).catch((err) => log.warn("event emit failed", { error: errorMessage(err) }));
  return json({ business: openedBusinessView(live!), ownerToken: ownerTokenFor(live!.id, live!.ownerTokenVersion), steps });
}

