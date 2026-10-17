// Pure helpers for the Awning plugin: API access, USDC math, live-quote reading
// and x402 proposal construction. No side effects at import time.
import { atomicAmount, proposeX402 } from "./paybox.js";

export const CHAIN = "eip155:8453" as const;
export const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const DEFAULT_API_URL = "https://api.awning.sh";
export const FETCH_TIMEOUT_MS = 4_000;
/** awning_plan drafts with an LLM server-side (bounded at ~6.5 s); still well inside the 10 s sandbox budget. */
export const PLAN_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_CHARS = 1_000_000;
const DEFAULT_PROPOSAL_TTL_MS = 240_000;
const MIN_APPROVAL_WINDOW_MS = 60_000;

/** An error whose message is safe and useful to show to the calling agent. */
export class AwningError extends Error {}

// ---------------------------------------------------------------- API base

/** The Awning API origin (plus optional path prefix), from AWNING_API_URL or the default. */
export function apiBase(raw: string | undefined = process.env.AWNING_API_URL): string {
  let url: URL;
  try {
    url = new URL(raw && raw.trim() ? raw.trim() : DEFAULT_API_URL);
  } catch {
    throw new AwningError("AWNING_API_URL is not a valid URL. The plugin owner should fix it in the PayBox portal (Variables & Secrets) or remove it to use https://api.awning.sh.");
  }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if ((url.protocol !== "https:" && !local) || url.username || url.password || url.search || url.hash) {
    throw new AwningError("AWNING_API_URL must be a plain https:// URL. The plugin owner should fix it in the PayBox portal or remove it to use https://api.awning.sh.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Host name shown to agents in error messages (never includes credentials). */
function apiHost(): string {
  try { return new URL(apiBase()).host; } catch { return "api.awning.sh"; }
}

// ---------------------------------------------------------------- HTTP

export type ApiResponse = { status: number; headers: Headers; data: unknown };

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  ownerToken?: string;
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
};

/**
 * One bounded request to the Awning API: 4 s timeout by default, no redirects, JSON only.
 * PayBox adds the brokered `x-awning-plugin-key` header at egress; this code never reads or sends it.
 */
export async function apiRequest(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const url = new URL(`${apiBase()}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.ownerToken !== undefined) headers["x-awning-owner-token"] = options.ownerToken;
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
      redirect: "error",
    });
    text = await response.text();
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AwningError(timedOut
      ? `Awning (${apiHost()}) did not answer within ${Math.round((options.timeoutMs ?? FETCH_TIMEOUT_MS) / 1000)} seconds. Nothing was changed or paid; retry once, then try again later.`
      : `Could not reach Awning (${apiHost()}). Nothing was changed or paid. If this keeps happening, the plugin owner should check that ${apiHost()} is an allowed network host in the PayBox portal.`);
  }
  if (text.length > MAX_RESPONSE_CHARS) throw new AwningError("Awning returned an unexpectedly large response. Nothing was paid; try again later.");
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  return { status: response.status, headers: response.headers, data };
}

/** Short, single-line message from an API error body, if it has one. */
export function apiMessage(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  // The API answers { error: <code>, message: <human text> }: prefer the text.
  const raw = typeof record.message === "string" ? record.message
    : typeof record.error === "string" ? record.error
    : record.error && typeof record.error === "object" && typeof (record.error as Record<string, unknown>).message === "string"
      ? (record.error as Record<string, string>).message
      : undefined;
  if (!raw) return undefined;
  const clean = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

/** Machine-readable error code from an API error body ({ error: "policy_blocked", message: "..." }). */
export function apiCode(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const code = (data as Record<string, unknown>).error;
  return typeof code === "string" && /^[a-z_]{2,40}$/.test(code) ? code : undefined;
}

type Expectation = { notFound?: string; ownerAuth?: boolean };

/** Returns the JSON body of a 2xx response, or throws an AwningError that tells the agent what to do. */
export function expectOk(response: ApiResponse, expectation: Expectation = {}): unknown {
  const { status, data } = response;
  if (status >= 200 && status < 300) return data;
  const detail = apiMessage(data);
  const with_ = (text: string) => (detail ? `${text} Awning said: "${detail}"` : text);
  const code = apiCode(data);
  if (code === "policy_blocked") {
    throw new AwningError(`${detail ?? "Awning's acceptable use policy does not allow this business."} Tell the user plainly; do not rephrase the request to get around the policy.`);
  }
  if (code === "business_suspended" || code === "business_unavailable") {
    throw new AwningError(with_("This business is paused while Awning reviews a report. Nothing was charged; do not retry."));
  }
  if (code === "rate_limited" && detail) throw new AwningError(`Awning limit reached: ${detail}`);
  if (status === 400 || status === 422) throw new AwningError(with_("Awning rejected the request as invalid. Check the inputs and try again."));
  if ((status === 401 || status === 403) && expectation.ownerAuth) {
    throw new AwningError("Awning rejected the owner token for this business. Use the ownerToken returned when the business opened (awning_open_free, or the paid awning_open response).");
  }
  if (status === 401) {
    throw new AwningError("Awning did not accept this plugin's credential. The plugin owner must add the brokered header x-awning-plugin-key for api.awning.sh in the PayBox portal (Variables & Secrets).");
  }
  if (status === 403) throw new AwningError(with_("Awning refused this request."));
  if (status === 404) throw new AwningError(expectation.notFound ?? with_("Awning could not find that resource."));
  if (status === 409) throw new AwningError(with_("This conflicts with the current state on Awning (for example, it was already opened or bought)."));
  if (status === 410) throw new AwningError(with_("This plan has expired. Call awning_plan again for a fresh plan and quote."));
  if (status === 429) throw new AwningError("Awning is rate limiting requests. Wait a minute before retrying.");
  if (status >= 500) throw new AwningError(`Awning is temporarily unavailable (HTTP ${status}). Nothing was paid; try again in a minute.`);
  throw new AwningError(with_(`Awning answered with unexpected HTTP status ${status}. Nothing was paid.`));
}

/** Validates an API body with a lenient schema; a mismatch becomes a safe, actionable error. */
export function parseApi<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AwningError("Awning returned a response this plugin version does not understand. Nothing was paid; try again later.");
  }
  return parsed.data;
}

// ---------------------------------------------------------------- USDC math

const DECIMAL = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

/** Converts a USD/USDC amount (decimal string or JSON number) into atomic USDC (6 decimals) without floats. */
export function usdToAtomic(value: number | string): string {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new AwningError("Prices must be finite, non-negative amounts.");
    text = String(value);
    if (/e/i.test(text)) throw new AwningError("Price is outside the range USDC can represent (6 decimals).");
  } else {
    text = value.trim();
  }
  if (!DECIMAL.test(text)) throw new AwningError(`"${text.slice(0, 32)}" is not a decimal amount like "19.00".`);
  const [whole, fraction = ""] = text.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  if (trimmed.length > 6) throw new AwningError("Amounts can have at most 6 decimal places (USDC precision).");
  try {
    return atomicAmount(trimmed ? `${whole}.${trimmed}` : `${whole}`, 6);
  } catch {
    throw new AwningError("Amount could not be converted to USDC units.");
  }
}

/** Formats atomic USDC as a decimal string with at least two decimals: 19000000 -> "19.00", 1234500 -> "1.2345". */
export function formatUsdc(atomic: string | bigint): string {
  const value = BigInt(atomic);
  if (value < 0n) throw new AwningError("Negative USDC amount.");
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${fraction}`;
}

/** Exact total of `qty` units at `unitAtomic`. */
export function totalAtomic(unitAtomic: string, qty: number): string {
  if (!Number.isSafeInteger(qty) || qty < 1) throw new AwningError("Quantity must be a positive whole number.");
  return (BigInt(unitAtomic) * BigInt(qty)).toString();
}

// ---------------------------------------------------------------- live x402 quote

export type LiveQuote =
  | { state: "verified"; amount: string; payTo: string | null }
  | { state: "unverified" }
  | { state: "incompatible" };

function decodeBase64Json(value: string): unknown {
  try { return JSON.parse(Buffer.from(value, "base64").toString("utf8")); } catch { return undefined; }
}

/**
 * Reads the amount Awning's x402 endpoint asks for in an unpaid 402 response
 * (x402 v2 `PAYMENT-REQUIRED` header, or a v1 JSON body). Only an "exact" USDC-on-Base
 * requirement counts. Anything else that is not a 402 is "unverified".
 */
export function readQuote(response: ApiResponse): LiveQuote {
  if (response.status !== 402) return { state: "unverified" };
  const header = response.headers.get("payment-required");
  const challenge = (header ? decodeBase64Json(header) : undefined) ?? response.data;
  if (!challenge || typeof challenge !== "object") return { state: "unverified" };
  const accepts = (challenge as { accepts?: unknown }).accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) return { state: "unverified" };
  for (const entry of accepts) {
    if (!entry || typeof entry !== "object") continue;
    const requirement = entry as Record<string, unknown>;
    const network = requirement.network;
    const asset = typeof requirement.asset === "string" ? requirement.asset.toLowerCase() : "";
    const amount = requirement.amount ?? requirement.maxAmountRequired;
    if (requirement.scheme !== "exact" || (network !== CHAIN && network !== "base") || asset !== USDC_BASE) continue;
    if (typeof amount !== "string" || !/^[1-9][0-9]{0,19}$/.test(amount)) continue;
    return { state: "verified", amount, payTo: typeof requirement.payTo === "string" ? requirement.payTo : null };
  }
  return { state: "incompatible" };
}

/** Fetches the unpaid quote. Awning's contract: an unpaid x402 request is a quote only and has no side effects. */
export async function fetchQuote(path: string, body: Record<string, unknown>): Promise<LiveQuote> {
  try {
    return readQuote(await apiRequest(path, { method: "POST", body }));
  } catch {
    return { state: "unverified" };
  }
}

// ---------------------------------------------------------------- proposals

function wholeSecond(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Proposal expiry: the starter's four minutes, or the provider quote's own expiry when that is sooner.
 * Refuses when less than a minute would be left for the user to approve.
 */
export function proposalExpiry(quoteExpiresAt?: string | null, now = Date.now()): string {
  let limit = now + DEFAULT_PROPOSAL_TTL_MS;
  if (quoteExpiresAt) {
    const quoted = Date.parse(quoteExpiresAt);
    if (!Number.isFinite(quoted)) throw new AwningError("Awning returned an unreadable quote expiry. Call awning_plan again.");
    limit = Math.min(limit, quoted);
  }
  if (limit - now < MIN_APPROVAL_WINDOW_MS) {
    throw new AwningError("This quote expires in less than a minute, too soon for the user to approve. Call awning_plan again for a fresh quote.");
  }
  return wholeSecond(limit);
}

export function segment(value: string): string {
  return encodeURIComponent(value);
}

export function openPath(planId: string): string {
  return `/x402/open/${segment(planId)}`;
}

export function buyPath(slug: string, sku: string): string {
  return `/x402/b/${segment(slug)}/${segment(sku)}`;
}

export function openBody(domain: string) {
  return { domain, package: "pro" as const };
}

export function buyBody(input: { qty: number; buyerNote?: string; buyerContact?: string }) {
  return {
    qty: input.qty,
    ...(input.buyerNote ? { buyerNote: input.buyerNote } : {}),
    ...(input.buyerContact ? { buyerContact: input.buyerContact } : {}),
  };
}

/** x402 proposal for `POST /x402/open/:planId` with `{domain, package: "pro"}`. */
export function proposeOpen(input: { planId: string; domain: string; maxAmount: string; expiresAt: string }) {
  return proposeX402({
    chain: CHAIN,
    url: `${apiBase()}${openPath(input.planId)}`,
    method: "POST",
    body: openBody(input.domain),
    maxAmount: input.maxAmount,
    expiresAt: input.expiresAt,
  });
}

/** x402 proposal for `POST /x402/b/:slug/:sku` with `{qty, buyerNote?, buyerContact?}`. */
export function proposeBuy(input: { slug: string; sku: string; body: ReturnType<typeof buyBody>; maxAmount: string; expiresAt: string }) {
  return proposeX402({
    chain: CHAIN,
    url: `${apiBase()}${buyPath(input.slug, input.sku)}`,
    method: "POST",
    body: input.body,
    maxAmount: input.maxAmount,
    expiresAt: input.expiresAt,
  });
}
