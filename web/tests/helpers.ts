import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { sql } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { adapters, resetAdapters, setAdapterOverrides } from "@/lib/adapters";
import type { Adapters } from "@/lib/adapters/types";
import { db, resetDbForTests } from "@/lib/db/client";
import { MockFacilitator, setFacilitatorForTests } from "@/lib/x402/facilitator";

import { POST as planPOST } from "@/app/v1/plan/route";
import { POST as openFreePOST } from "@/app/v1/open-free/route";
import { POST as openPOST } from "@/app/x402/open/[planId]/route";
import { POST as buyPOST } from "@/app/x402/b/[slug]/[sku]/route";
import { GET as ordersGET } from "@/app/v1/orders/route";
import { POST as offersPOST } from "@/app/v1/businesses/[slug]/offers/route";

export const PLUGIN_KEY = "test-plugin-key";
export const TREASURY = "0x4a8B4f274979d744B55f8d77FD5B1c5Ac1DD3C1e";
export const API = "https://api.awning.sh";

export async function freshWorld(overrides: Partial<Adapters> = {}) {
  await resetDbForTests();
  resetAdapters();
  if (Object.keys(overrides).length) setAdapterOverrides(overrides);
  const facilitator = new MockFacilitator();
  setFacilitatorForTests(facilitator);
  await db();
  return { facilitator, adapters: adapters() };
}

export function newBuyer(): PrivateKeyAccount {
  return privateKeyToAccount(generatePrivateKey());
}

function req(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

export async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function createPlan(sentence = "Start a business: Ridge Roast — small-batch coffee from Accra, ship bags and sell a $5 tasting session.", ownerWallet?: string) {
  const res = await planPOST(
    req("POST", "/v1/plan", { body: { sentence, ownerWallet: ownerWallet ?? newBuyer().address, ownerName: "Ama Owusu" }, headers: { "x-awning-plugin-key": PLUGIN_KEY } }),
  );
  if (res.status !== 201) throw new Error(`plan failed ${res.status}: ${await res.text()}`);
  return readJson(res);
}

export async function openFree(planId: string) {
  return openFreePOST(req("POST", "/v1/open-free", { body: { planId }, headers: { "x-awning-plugin-key": PLUGIN_KEY } }));
}

export async function openPaid(planId: string, body: unknown, headers: Record<string, string> = {}) {
  return openPOST(req("POST", `/x402/open/${planId}`, { body, headers }), { params: Promise.resolve({ planId }) });
}

export async function buy(slug: string, sku: string, body: unknown, headers: Record<string, string> = {}) {
  return buyPOST(req("POST", `/x402/b/${slug}/${sku}`, { body, headers }), { params: Promise.resolve({ slug, sku }) });
}

export async function orders(slug: string, headers: Record<string, string>) {
  return ordersGET(req("GET", `/v1/orders?slug=${slug}`, { headers }));
}

export async function addOffer(slug: string, body: unknown, headers: Record<string, string>) {
  return offersPOST(req("POST", `/v1/businesses/${slug}/offers`, { body, headers }), { params: Promise.resolve({ slug }) });
}

export function decodeChallenge(res: Response): PaymentRequired {
  const h = res.headers.get("PAYMENT-REQUIRED");
  if (!h) throw new Error("no PAYMENT-REQUIRED header");
  return decodePaymentRequiredHeader(h);
}

/** Sign a real EIP-3009 authorization for a 402 challenge, as a PayBox wallet would. */
export async function signPayment(challenge: Response, account: PrivateKeyAccount): Promise<string> {
  const required = decodeChallenge(challenge);
  const client = x402Client.fromConfig({ schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }], spendControls: false });
  const payload = await client.createPaymentPayload(required);
  return encodePaymentSignatureHeader(payload);
}

export async function tableCounts() {
  const d = await db();
  const out: Record<string, number> = {};
  for (const t of ["plans", "businesses", "offers", "orders", "events", "payments"]) {
    const r = (await d.execute(sql.raw(`select count(*)::int as n from ${t}`))) as unknown as { rows: { n: number }[] };
    out[t] = Number(r.rows[0]?.n ?? 0);
  }
  return out;
}

export async function rows(table: string): Promise<any[]> {
  const d = await db();
  const r = (await d.execute(sql.raw(`select * from ${table}`))) as unknown as { rows: any[] };
  return r.rows;
}
