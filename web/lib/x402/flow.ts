import { and, eq } from "drizzle-orm";
import { getAddress } from "viem";
import type { SettleResponse } from "@x402/core/types";
import { db, schema } from "../db/client";
import type { PaymentStatus, StoredResponse } from "../db/schema";
import { adapters } from "../adapters";
import { errorMessage, log } from "../log";
import { atomicToUsd } from "../money";
import { BASE_NETWORK, USDC_BASE } from "./constants";
import { facilitator } from "./facilitator";
import {
  type Charge,
  type IncomingPayment,
  extractPayment,
  matchPayment,
  paymentKey,
  paymentRequiredResponse,
  paymentResponseHeaders,
  requirementsFor,
} from "./seller";

/**
 * Shared x402 paid-request lifecycle ("pay only on success"):
 *
 *   unpaid            → 402 challenge (pure; no reads beyond the quote, no writes)
 *   paid, seen before → replay the stored response (same payment ⇒ same result)
 *   paid, new         → verify → claim idempotency key → work → settle → commit
 *
 * Work never moves money. Settlement happens only after the work succeeded;
 * if work fails, the authorization is never settled and the payer keeps their
 * USDC. If something fails *after* settlement, `compensate` undoes the work
 * and the payer is refunded from the treasury (only possible when payTo is
 * the treasury).
 */

export type PaidContext = { payment: IncomingPayment; key: string; payer: string };
export type SettleInfo = { tx: string | null; payer: string; network: string; confirmed: boolean };

export type WorkResult =
  | {
      ok: true;
      /** Persist the outcome (business live / order paid). Runs after settlement. */
      commit: (s: SettleInfo) => Promise<{ status?: number; body: unknown }>;
      /** Undo the work (settlement failed, or commit failed after settlement). */
      compensate: (reason: string) => Promise<void>;
    }
  /** Work failed before settlement: nothing was charged. */
  | { ok: false; status: number; body: unknown }
  /** Nothing to do (e.g. already done by another payment): do not settle. */
  | { ok: "skip"; status: number; body: unknown }
  /** Transient conflict (e.g. the same plan is being opened by another payment): release the key so a retry is re-evaluated. */
  | { ok: "retry"; status: number; body: unknown };

export type PaidFlowOptions = {
  req: Request;
  charge: Charge;
  purpose: "open" | "order";
  refId: string;
  /** Extra fields for the 402 body (`awning`): the human/agent readable quote. */
  quote: Record<string, unknown>;
  work: (ctx: PaidContext) => Promise<WorkResult>;
  /** May the payer be refunded from the treasury? (true only when payTo is the treasury) */
  refundable: boolean;
};

function respond(r: StoredResponse): Response {
  return new Response(JSON.stringify(r.body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status: r.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
      ...(r.headers ?? {}),
    },
  });
}

async function finish(key: string, status: PaymentStatus, response: StoredResponse, fields: { tx?: string | null; refundTx?: string | null; error?: string | null } = {}) {
  const d = await db();
  await d
    .update(schema.payments)
    .set({ status, response, updatedAt: new Date(), ...fields })
    .where(eq(schema.payments.key, key));
  return respond(response);
}

/**
 * A payment we have already answered gets the same answer again — before any
 * quote is recomputed, so a later change (offer removed, plan expired, config
 * changed) can never turn a completed purchase into an error or a new charge.
 */
export async function replayIfSeen(req: Request): Promise<Response | null> {
  const extracted = extractPayment(req);
  if (extracted.kind !== "payment") return null;
  const d = await db();
  const [seen] = await d.select().from(schema.payments).where(eq(schema.payments.key, paymentKey(extracted.payment.authorization))).limit(1);
  if (seen?.response) return respond(seen.response);
  if (seen) return respondInProgress();
  return null;
}

export async function handlePaidRequest(o: PaidFlowOptions): Promise<Response> {
  const extracted = extractPayment(o.req);
  if (extracted.kind === "none") return paymentRequiredResponse(o.charge, { extra: o.quote });
  if (extracted.kind === "invalid") return paymentRequiredResponse(o.charge, { error: extracted.reason, extra: o.quote });

  const payment = extracted.payment;

  // Replay: the same signed authorization always gets the same answer, even
  // if the price or state changed since (e.g. the plan is now open).
  const d = await db();
  const [seen] = await d.select().from(schema.payments).where(eq(schema.payments.key, paymentKey(payment.authorization))).limit(1);
  if (seen?.response) return respond(seen.response);
  if (seen) return respondInProgress();

  const match = matchPayment(payment, o.charge);
  if (!match.ok) return paymentRequiredResponse(o.charge, { error: match.reason, extra: o.quote });

  const requirements = await requirementsFor(payment, o.charge);
  const f = facilitator();
  const verified = await f.verify(payment.payload, requirements);
  if (!verified.isValid) {
    return paymentRequiredResponse(o.charge, { error: verified.invalidReason ?? "invalid_payment", extra: { ...o.quote, detail: verified.invalidMessage ?? null } });
  }

  // Claim the idempotency key. A concurrent duplicate loses the insert.
  const claimed = await d
    .insert(schema.payments)
    .values({
      key: match.key,
      purpose: o.purpose,
      refId: o.refId,
      status: "working",
      x402Version: payment.version,
      network: BASE_NETWORK,
      asset: USDC_BASE,
      payer: match.payer,
      payTo: o.charge.payTo.toLowerCase(),
      amountAtomic: o.charge.amountAtomic,
    })
    .onConflictDoNothing()
    .returning({ key: schema.payments.key });
  if (!claimed.length) return respondInProgress();

  const ctx: PaidContext = { payment, key: match.key, payer: match.payer };
  let result: WorkResult;
  try {
    result = await o.work(ctx);
  } catch (err) {
    log.error("paid work threw before settlement", { purpose: o.purpose, refId: o.refId, error: errorMessage(err) });
    result = { ok: false, status: 500, body: { error: "work_failed", message: "The request failed before payment was taken. You were not charged.", charged: false, refunded: false } };
  }

  if (result.ok === false) return finish(match.key, "failed", { status: result.status, body: result.body }, { error: "work_failed" });
  if (result.ok === "skip") return finish(match.key, "superseded", { status: result.status, body: result.body });
  if (result.ok === "retry") {
    await d.delete(schema.payments).where(and(eq(schema.payments.key, match.key), eq(schema.payments.status, "working")));
    return respond({ status: result.status, body: result.body, headers: { "retry-after": "3" } });
  }

  // Work succeeded: now, and only now, move the money.
  const settled = await settleWithTruth(payment, requirements);
  if (settled.state === "failed") {
    await result.compensate(`settlement failed: ${settled.reason}`).catch((err) => log.error("compensation after failed settlement failed", { error: errorMessage(err) }));
    const challenge = await paymentRequiredResponse(o.charge, { error: `settlement_failed: ${settled.reason}`, extra: o.quote });
    const body = { error: "settlement_failed", message: `Payment could not be settled (${settled.reason}). Nothing was charged and nothing was provisioned.`, charged: false, refunded: false };
    return finish(match.key, "failed", { status: 402, body, headers: { "PAYMENT-REQUIRED": challenge.headers.get("PAYMENT-REQUIRED") ?? "" } }, { error: settled.reason });
  }

  const info: SettleInfo = { tx: settled.response?.transaction || null, payer: getAddress(match.payer), network: BASE_NETWORK, confirmed: settled.state === "settled" };
  const settleResponse: SettleResponse = settled.response ?? { success: true, transaction: "", network: BASE_NETWORK, payer: match.payer };
  const headers = paymentResponseHeaders(settleResponse);

  try {
    const committed = await result.commit(info);
    const status: PaymentStatus = settled.state === "settled" ? "settled" : "unconfirmed";
    return finish(match.key, status, { status: committed.status ?? 200, body: committed.body, headers }, { tx: info.tx });
  } catch (err) {
    // Money moved but we could not deliver. Undo and give it back.
    const reason = `commit failed after settlement: ${errorMessage(err)}`;
    log.error("post-settlement failure", { purpose: o.purpose, refId: o.refId, error: reason });
    await result.compensate(reason).catch((e) => log.error("compensation failed", { error: errorMessage(e) }));
    if (!o.refundable) {
      const body = { error: "delivery_failed", message: "Payment settled to the seller but the order could not be recorded. Contact the seller with this transaction.", charged: true, refunded: false, tx: info.tx };
      return finish(match.key, "settled", { status: 502, body, headers }, { tx: info.tx, error: reason });
    }
    try {
      const refund = await adapters().refunder.refund({ to: match.payer, amountAtomic: o.charge.amountAtomic, reason });
      const body = { refunded: true, refundTx: refund.tx, reason: PUBLIC_DELIVERY_FAILURE, charged: true, paidUsd: atomicToUsd(o.charge.amountAtomic), tx: info.tx };
      return finish(match.key, "refunded", { status: 502, body, headers }, { tx: info.tx, refundTx: refund.tx, error: reason });
    } catch (refundErr) {
      const body = { refunded: false, reason: PUBLIC_DELIVERY_FAILURE, charged: true, paidUsd: atomicToUsd(o.charge.amountAtomic), tx: info.tx, message: "The automatic refund could not be sent. Awning's operator has been alerted and will refund this payment; keep this response." };
      log.error("REFUND FAILED — manual action required", { key: match.key, payer: match.payer, amountAtomic: o.charge.amountAtomic, error: errorMessage(refundErr) });
      return finish(match.key, "settled", { status: 502, body, headers }, { tx: info.tx, error: `${reason}; refund failed: ${errorMessage(refundErr)}` });
    }
  }
}

/** What a payer is told when delivery failed after settlement (the internal reason is logged and stored). */
const PUBLIC_DELIVERY_FAILURE = "Your payment settled but the result could not be recorded.";

function respondInProgress(): Response {
  return new Response(JSON.stringify({ error: "payment_in_progress", message: "This payment is already being processed. Do not pay again; check the result shortly.", charged: false }), {
    status: 409,
    headers: { "content-type": "application/json", "retry-after": "3", "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}

type SettleTruth =
  | { state: "settled"; response: SettleResponse }
  | { state: "unconfirmed"; response?: undefined }
  | { state: "failed"; reason: string };

/**
 * Settle, and when the facilitator's answer is not a clean success, ask the
 * chain: USDC's `authorizationState(from, nonce)` says whether the transfer
 * actually happened. One retry when the chain says it did not.
 */
async function settleWithTruth(payment: IncomingPayment, requirements: Record<string, unknown>): Promise<SettleTruth> {
  const f = facilitator();
  let lastReason = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await f.settle(payment.payload, requirements);
    if (r.status === "settled") return { state: "settled", response: r.response };
    lastReason = r.reason;
    let used: boolean | null = null;
    try {
      used = await f.authorizationUsed(payment.authorization);
    } catch (err) {
      log.warn("authorizationState check failed", { error: errorMessage(err) });
    }
    if (used === true) return { state: "unconfirmed" };
    if (used === null && r.status === "unknown") return { state: "unconfirmed" };
    if (r.status === "failed" && attempt === 0 && !/nonce|expired|insufficient|signature|invalid/i.test(r.reason)) continue;
    if (r.status === "unknown" && attempt === 0) continue;
    break;
  }
  return { state: "failed", reason: lastReason };
}

/** Lookup used by tests and the owner dashboard. */
export async function paymentsFor(refId: string) {
  const d = await db();
  return d.select().from(schema.payments).where(and(eq(schema.payments.refId, refId)));
}
