import { z } from "zod";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequired, PaymentRequirements, PaymentRequiredV1, PaymentRequirementsV1, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { BASE_NETWORK, BASE_NETWORK_V1, MAX_TIMEOUT_SECONDS, SCHEME, USDC_BASE, USDC_EIP712 } from "./constants";

/**
 * x402 seller for route handlers with a per-request price and payTo.
 *
 * Unpaid request → 402 with the v2 `PAYMENT-REQUIRED` header (base64 JSON) and
 * a v1-compatible JSON body (`x402Version: 1`, `accepts[]`), so both protocol
 * generations can pay. Paid retry → `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1).
 * Building a 402 is pure: no I/O, no DB, no side effects.
 */

export type Charge = {
  amountAtomic: bigint;
  payTo: string;
  resourceUrl: string;
  description: string;
};

const evmServer = new ExactEvmScheme();

export async function requirementsV2(c: Charge): Promise<PaymentRequirements> {
  // AssetAmount pricing: exact atomic amount, explicit asset and EIP-712 domain.
  const price = await evmServer.parsePrice(
    { amount: c.amountAtomic.toString(), asset: USDC_BASE, extra: { ...USDC_EIP712 } },
    BASE_NETWORK,
  );
  return {
    scheme: SCHEME,
    network: BASE_NETWORK,
    amount: price.amount,
    asset: price.asset,
    payTo: c.payTo,
    maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
    extra: price.extra ?? { ...USDC_EIP712 },
  };
}

export function requirementsV1(c: Charge): PaymentRequirementsV1 {
  return {
    scheme: SCHEME,
    // v1 uses plain network names ("base"); the shared type is CAIP-2 shaped.
    network: BASE_NETWORK_V1 as unknown as PaymentRequirementsV1["network"],
    maxAmountRequired: c.amountAtomic.toString(),
    resource: c.resourceUrl,
    description: c.description,
    mimeType: "application/json",
    outputSchema: {},
    payTo: c.payTo,
    maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
    asset: USDC_BASE,
    extra: { ...USDC_EIP712 },
  };
}

export async function paymentRequiredObject(c: Charge, error?: string): Promise<PaymentRequired> {
  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: { url: c.resourceUrl, description: c.description, mimeType: "application/json", serviceName: "Awning" },
    accepts: [await requirementsV2(c)],
  };
}

const EXPOSE = "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE";

/** The 402 challenge. `extra` lands in the body under `awning` (human/agent readable quote). */
export async function paymentRequiredResponse(c: Charge, opts: { error?: string; extra?: Record<string, unknown> } = {}): Promise<Response> {
  const v2 = await paymentRequiredObject(c, opts.error);
  const v1: PaymentRequiredV1 & { awning?: Record<string, unknown> } = {
    x402Version: 1,
    error: opts.error ?? "payment_required",
    accepts: [requirementsV1(c)],
    ...(opts.extra ? { awning: opts.extra } : {}),
  };
  return new Response(JSON.stringify(v1), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "PAYMENT-REQUIRED": encodePaymentRequiredHeader(v2),
      "cache-control": "no-store, private",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": EXPOSE,
    },
  });
}

// ---------------------------------------------------------------------------
// Paid retry: decode, check against the charge, derive the idempotency key.

const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
const authorizationSchema = z.object({
  from: hex,
  to: hex,
  value: z.union([z.string(), z.number()]).transform((v) => String(v)),
  validAfter: z.union([z.string(), z.number()]).transform((v) => String(v)),
  validBefore: z.union([z.string(), z.number()]).transform((v) => String(v)),
  nonce: hex,
});
const evmPayloadSchema = z.object({ signature: hex, authorization: authorizationSchema }).passthrough();

const v2Schema = z
  .object({
    x402Version: z.literal(2),
    accepted: z
      .object({
        scheme: z.string(),
        network: z.string(),
        asset: z.string(),
        amount: z.string(),
        payTo: z.string(),
      })
      .passthrough(),
    payload: evmPayloadSchema,
  })
  .passthrough();

const v1Schema = z
  .object({
    x402Version: z.literal(1),
    scheme: z.string(),
    network: z.string(),
    payload: evmPayloadSchema,
  })
  .passthrough();

export type Authorization = z.infer<typeof authorizationSchema>;

export type IncomingPayment = {
  version: 1 | 2;
  /** Exactly what the client sent, forwarded to the facilitator. */
  payload: Record<string, unknown>;
  scheme: string;
  network: string;
  authorization: Authorization;
};

export type ExtractResult = { kind: "none" } | { kind: "invalid"; reason: string } | { kind: "payment"; payment: IncomingPayment };

function decodeBase64Json(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

export function extractPayment(req: Request): ExtractResult {
  const v2Header = req.headers.get("payment-signature");
  const v1Header = req.headers.get("x-payment");
  if (!v2Header && !v1Header) return { kind: "none" };
  try {
    if (v2Header) {
      const decoded = decodePaymentSignatureHeader(v2Header) as PaymentPayload;
      const p = v2Schema.safeParse(decoded);
      if (!p.success) return { kind: "invalid", reason: "unsupported_payload: expected an exact EVM (EIP-3009) v2 payment" };
      return {
        kind: "payment",
        payment: { version: 2, payload: decoded as unknown as Record<string, unknown>, scheme: p.data.accepted.scheme, network: p.data.accepted.network, authorization: p.data.payload.authorization },
      };
    }
    const decoded = decodeBase64Json(v1Header!);
    const p = v1Schema.safeParse(decoded);
    if (!p.success) return { kind: "invalid", reason: "unsupported_payload: expected an exact EVM (EIP-3009) v1 payment" };
    return {
      kind: "payment",
      payment: { version: 1, payload: decoded as Record<string, unknown>, scheme: p.data.scheme, network: p.data.network, authorization: p.data.payload.authorization },
    };
  } catch {
    return { kind: "invalid", reason: "malformed_payment_header" };
  }
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type MatchResult = { ok: true; key: string; payer: string } | { ok: false; reason: string };

/**
 * The payment must be for exactly this charge: same scheme, network, asset,
 * amount and payTo — both in the declared terms and inside the signed
 * authorization — and still inside its validity window.
 */
export function matchPayment(p: IncomingPayment, c: Charge, nowSec = Math.floor(Date.now() / 1000)): MatchResult {
  if (p.scheme !== SCHEME) return { ok: false, reason: "unsupported_scheme" };
  if (p.version === 2) {
    const acc = (p.payload as { accepted: { network: string; asset: string; amount: string; payTo: string } }).accepted;
    if (acc.network !== BASE_NETWORK) return { ok: false, reason: "wrong_network" };
    if (!eq(acc.asset, USDC_BASE)) return { ok: false, reason: "wrong_asset" };
    if (acc.amount !== c.amountAtomic.toString()) return { ok: false, reason: "amount_mismatch" };
    if (!eq(acc.payTo, c.payTo)) return { ok: false, reason: "payto_mismatch" };
  } else if (p.network !== BASE_NETWORK_V1 && p.network !== BASE_NETWORK) {
    return { ok: false, reason: "wrong_network" };
  }
  const a = p.authorization;
  if (!eq(a.to, c.payTo)) return { ok: false, reason: "payto_mismatch" };
  let value: bigint;
  try {
    value = BigInt(a.value);
  } catch {
    return { ok: false, reason: "invalid_amount" };
  }
  if (value !== c.amountAtomic) return { ok: false, reason: "amount_mismatch" };
  if (Number(a.validBefore) <= nowSec + 3) return { ok: false, reason: "authorization_expired" };
  if (Number(a.validAfter) > nowSec + 5) return { ok: false, reason: "authorization_not_yet_valid" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(a.nonce)) return { ok: false, reason: "invalid_nonce" };
  return { ok: true, key: paymentKey(a), payer: a.from.toLowerCase() };
}

/** Identity of a signed authorization — it can settle at most once on chain. */
export function paymentKey(a: Authorization): string {
  return `${BASE_NETWORK}:${USDC_BASE.toLowerCase()}:${a.from.toLowerCase()}:${a.nonce.toLowerCase()}`;
}

/** Requirements object in the client's protocol version, for verify/settle. */
export async function requirementsFor(p: IncomingPayment, c: Charge): Promise<Record<string, unknown>> {
  return p.version === 2 ? ((await requirementsV2(c)) as unknown as Record<string, unknown>) : (requirementsV1(c) as unknown as Record<string, unknown>);
}

export function paymentResponseHeaders(settle: SettleResponse): Record<string, string> {
  const encoded = encodePaymentResponseHeader(settle);
  return {
    "PAYMENT-RESPONSE": encoded,
    "X-PAYMENT-RESPONSE": encoded,
    "access-control-allow-origin": "*",
    "access-control-expose-headers": EXPOSE,
  };
}
