import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { adapters } from "../adapters";
import { db, schema } from "../db/client";
import type { PaymentRow, StoredResponse } from "../db/schema";
import { errorMessage, log } from "../log";
import { alertOperator } from "../ops/alert";
import { atomicToUsd } from "../money";
import { facilitator } from "./facilitator";
import type { Authorization } from "./seller";

/**
 * Reconciler for payments a request left unfinished (the function was killed,
 * or the facilitator's answer was unclear). The chain is the source of truth:
 * USDC's authorizationState(from, nonce) says whether the money moved.
 *
 *   working, money did not move  → failed; the payer was not charged and may pay again
 *   working, money moved, open   → refunded from the treasury (or flagged if the refund fails)
 *   working, money moved, order  → flagged: the seller was paid but the order was not recorded
 *   unconfirmed, money moved     → settled
 *   unconfirmed, never moved     → failed after the authorization can no longer settle; flagged
 *
 * Every outcome is stored as the payment's response, so a replay of the same
 * signed payment gets a definitive answer instead of "in progress" forever.
 */

/** Longer than any paid request can live (route maxDuration is 90 s). */
export const STALE_AFTER_MS = 3 * 60_000;
/** x402 authorizations here are valid for at most 5 minutes; after this, an unused one can never settle. */
const NEVER_SETTLES_AFTER_MS = 15 * 60_000;

export type ReconcileOutcome = { key: string; from: PaymentRow["status"]; to: PaymentRow["status"] | "unchanged"; note: string };

function keyParts(key: string): Pick<Authorization, "from" | "nonce"> | null {
  // `<network>:<asset>:<payer>:<nonce>`, network itself contains a colon (eip155:8453).
  const parts = key.split(":");
  const nonce = parts.at(-1);
  const from = parts.at(-2);
  if (!nonce || !from || !/^0x[0-9a-f]{64}$/.test(nonce) || !/^0x[0-9a-f]{40}$/.test(from)) return null;
  return { from, nonce };
}

async function store(key: string, status: PaymentRow["status"], response: StoredResponse, fields: { refundTx?: string | null; error?: string | null } = {}) {
  const d = await db();
  await d.update(schema.payments).set({ status, response, updatedAt: new Date(), ...fields }).where(eq(schema.payments.key, key));
}

/**
 * Optimistic claim: only the run that moves updatedAt first may act on a row,
 * so two reconcilers (cron + health) can never refund the same payment twice.
 */
async function claim(p: PaymentRow): Promise<boolean> {
  const d = await db();
  const won = await d
    .update(schema.payments)
    .set({ updatedAt: new Date() })
    // Postgres keeps microseconds, JS Dates milliseconds: compare at millisecond precision.
    .where(and(eq(schema.payments.key, p.key), eq(schema.payments.status, p.status), sql`date_trunc('milliseconds', ${schema.payments.updatedAt}) = ${p.updatedAt.toISOString()}::timestamptz`))
    .returning({ key: schema.payments.key });
  return won.length === 1;
}

/** A plan stuck in "opening" for this payment goes back to where it was, so the owner can try again. */
async function releasePlan(p: PaymentRow, why: string) {
  if (p.purpose !== "open") return;
  const d = await db();
  const [plan] = await d.select().from(schema.plans).where(eq(schema.plans.id, p.refId)).limit(1);
  if (!plan || plan.openPaymentKey !== p.key) return;
  const [biz] = await d.select().from(schema.businesses).where(eq(schema.businesses.id, plan.businessId)).limit(1);
  const live = biz?.status === "live";
  await d
    .update(schema.plans)
    .set({ status: live ? "opened" : "quoted", openPaymentKey: null, lastError: why.slice(0, 500), updatedAt: new Date() })
    .where(and(eq(schema.plans.id, plan.id), eq(schema.plans.openPaymentKey, p.key)));
  // Steps that finished before the interruption may have created provider resources.
  await alertOperator("interrupted paid open: check provider resources for this plan", { planId: plan.id, steps: plan.openSteps, provisioning: biz?.provisioning });
}

export async function reconcilePayments(opts: { now?: number; limit?: number } = {}): Promise<ReconcileOutcome[]> {
  const now = opts.now ?? Date.now();
  const d = await db();
  const rows = await d
    .select()
    .from(schema.payments)
    .where(and(inArray(schema.payments.status, ["working", "unconfirmed"]), lt(schema.payments.updatedAt, new Date(now - STALE_AFTER_MS))))
    .limit(opts.limit ?? 25);

  const out: ReconcileOutcome[] = [];
  for (const p of rows) {
    const auth = keyParts(p.key);
    if (!auth) {
      out.push({ key: p.key, from: p.status, to: "unchanged", note: "unparseable key" });
      continue;
    }
    let used: boolean;
    try {
      used = await facilitator().authorizationUsed(auth as Authorization);
    } catch (err) {
      out.push({ key: p.key, from: p.status, to: "unchanged", note: `chain read failed: ${errorMessage(err)}` });
      continue;
    }
    const paidUsd = atomicToUsd(p.amountAtomic);
    const neverSettles = p.status === "unconfirmed" && !used && now - p.updatedAt.getTime() > NEVER_SETTLES_AFTER_MS;
    const actionable = p.status === "working" || used || neverSettles;
    if (actionable && !(await claim(p))) {
      out.push({ key: p.key, from: p.status, to: "unchanged", note: "claimed by another run" });
      continue;
    }

    if (p.status === "working" && !used) {
      const body = { error: "work_interrupted", message: "Processing was interrupted before payment was taken. You were not charged; you can pay again.", charged: false, refunded: false };
      await store(p.key, "failed", { status: 503, body }, { error: "interrupted before settlement (reconciled)" });
      await releasePlan(p, "interrupted before settlement; not charged");
      out.push({ key: p.key, from: "working", to: "failed", note: "money did not move" });
      continue;
    }

    if (p.status === "working" && used && p.purpose === "open") {
      const reason = "interrupted after settlement (reconciled)";
      try {
        const refund = await adapters().refunder.refund({ to: p.payer, amountAtomic: p.amountAtomic, reason });
        const body = { refunded: true, refundTx: refund.tx, reason: "Your payment settled but the opening could not be completed, so it was refunded.", charged: true, paidUsd };
        await store(p.key, "refunded", { status: 502, body }, { refundTx: refund.tx, error: reason });
        out.push({ key: p.key, from: "working", to: "refunded", note: `refund ${refund.tx}` });
      } catch (err) {
        const body = { refunded: false, charged: true, paidUsd, message: "Your payment settled but the opening could not be completed. Awning's operator has been alerted and will refund it; keep this response." };
        await store(p.key, "settled", { status: 502, body }, { error: `${reason}; refund failed: ${errorMessage(err)}` });
        await alertOperator("REFUND REQUIRED: automatic refund failed", { key: p.key, payer: p.payer, amountAtomic: p.amountAtomic, error: errorMessage(err) });
        out.push({ key: p.key, from: "working", to: "settled", note: "refund failed; operator alerted" });
      }
      await releasePlan(p, reason);
      continue;
    }

    if (p.status === "working" && used) {
      const body = { error: "delivery_failed", message: "Payment settled to the seller but the order could not be recorded. Contact the seller with this payment.", charged: true, refunded: false, paidUsd };
      await store(p.key, "settled", { status: 502, body }, { error: "order settled but not recorded (reconciled)" });
      await alertOperator("order settled to the seller but not recorded", { key: p.key, refId: p.refId, payer: p.payer, payTo: p.payTo, amountAtomic: p.amountAtomic });
      out.push({ key: p.key, from: "working", to: "settled", note: "order not recorded; operator alerted" });
      continue;
    }

    if (p.status === "unconfirmed" && used) {
      await store(p.key, "settled", p.response ?? { status: 200, body: { ok: true } });
      out.push({ key: p.key, from: "unconfirmed", to: "settled", note: "confirmed on chain" });
      continue;
    }

    if (neverSettles) {
      await store(p.key, "failed", p.response ?? { status: 200, body: { ok: true } }, { error: "delivered but the authorization never settled (reconciled)" });
      await alertOperator("delivered without settlement", { key: p.key, purpose: p.purpose, refId: p.refId, amountAtomic: p.amountAtomic });
      out.push({ key: p.key, from: "unconfirmed", to: "failed", note: "never settled; operator alerted" });
      continue;
    }

    out.push({ key: p.key, from: p.status, to: "unchanged", note: "waiting for the authorization to settle or expire" });
  }
  if (out.length) log.info("reconciled payments", { count: out.length, outcomes: out.map((o) => `${o.from}→${o.to}`) });
  return out;
}
