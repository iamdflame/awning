import { env } from "../env";
import { log } from "../log";
import { stableIndex } from "../ids";
import { usdStringToCents } from "../money";
import { ProviderError, excerpt, http, obj } from "./http";
import type { DnsRecord, DomainCheck, Registrar } from "./types";

const PORKBUN = "https://api.porkbun.com/api/json/v3";

/**
 * Porkbun API v3 (https://porkbun.com/api/json/v3/documentation).
 * - availability + price: POST /domain/checkDomain (bulk, up to 25)
 * - register: POST /domain/create/{domain} with `cost` in cents (must equal the
 *   live price) and an Idempotency-Key, paid from account credit — or, with
 *   PORKBUN_PAY_WITH=usdc, directly in USDC over x402 from the treasury wallet
 *   (`payWith: "usdc"` → 402 PAYMENT-REQUIRED → pay → repeat with PAYMENT-SIGNATURE).
 * - DNS: deleteByNameType (parking records) then POST /dns/create/{domain}.
 */
export class PorkbunRegistrar implements Registrar {
  readonly name = "porkbun";
  readonly mock = false;
  constructor(
    private readonly apiKey: string,
    private readonly secretKey: string,
    private readonly payWith: "credit" | "usdc" | "auto",
  ) {}

  /** Prepaid balance in cents (0 when it cannot be read). */
  private async balanceCents(signal?: AbortSignal): Promise<number> {
    const res = await this.post("/account/balance", {}, { signal, timeoutMs: 4000 });
    const r = obj(res.json);
    return res.ok && r.status === "SUCCESS" ? Number(r.balance ?? 0) : 0;
  }

  /** How this purchase is paid: account credit is fastest (no on-chain step), USDC needs no balance. */
  private async methodFor(cents: number, signal?: AbortSignal): Promise<"credit" | "usdc"> {
    if (this.payWith !== "auto") return this.payWith;
    const balance = await this.balanceCents(signal).catch(() => 0);
    return balance >= cents ? "credit" : "usdc";
  }

  private auth() {
    return { apikey: this.apiKey, secretapikey: this.secretKey };
  }

  private async post(path: string, body: Record<string, unknown>, opts: { idem?: string; signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { "content-type": "application/json", ...(opts.headers ?? {}) };
    if (opts.idem) headers["idempotency-key"] = opts.idem;
    return http(`${PORKBUN}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...this.auth(), ...body }),
      signal: opts.signal,
      timeoutMs: opts.timeoutMs ?? 10000,
    });
  }

  async check(domains: string[], signal?: AbortSignal): Promise<DomainCheck[]> {
    const res = await this.post("/domain/checkDomain", { domains }, { signal, timeoutMs: 8000 });
    const body = obj(res.json);
    if (!res.ok || body.status !== "SUCCESS") {
      throw new ProviderError("porkbun", `checkDomain failed (${res.status}): ${excerpt(String(body.message ?? res.text))}`, res.status, String(body.code ?? ""));
    }
    const answered = obj(body.domains);
    const unresolved = new Set(Array.isArray(body.unresolved) ? (body.unresolved as string[]).map((d) => d.toLowerCase()) : []);
    return domains.map((domain) => {
      const r = obj(answered[domain] ?? answered[domain.toLowerCase()]);
      if (unresolved.has(domain.toLowerCase()) || !r.avail) {
        return { domain, available: false, priceUsd: "0", cents: 0, premium: false, unresolved: true };
      }
      const premium = r.premium === "yes" || r.premium === true;
      const minDuration = Number(r.minDuration ?? 1);
      const priceUsd = String(r.price ?? "0");
      let cents = 0;
      try {
        cents = usdStringToCents(priceUsd);
      } catch {
        cents = 0;
      }
      // Premium names cannot be registered over the API; multi-year minimum
      // terms would make the quoted first-year price wrong. Treat both as unavailable.
      const available = r.avail === "yes" && !premium && minDuration === 1 && cents > 0;
      return { domain, available, priceUsd, cents, premium, inAccount: r.inYourAccount === true };
    });
  }

  async register(domain: string, cents: number, idempotencyKey: string, signal?: AbortSignal) {
    const method = await this.methodFor(cents, signal);
    const body: Record<string, unknown> = { cost: cents, agreeToTerms: "yes" };
    if (method === "usdc") body.payWith = "usdc";
    let res = await this.post(`/domain/create/${domain}`, body, { idem: idempotencyKey, signal, timeoutMs: 15000 });

    if (res.status === 402 && method === "usdc") {
      const header = res.headers.get("payment-required");
      if (!header) throw new ProviderError("porkbun", "402 without PAYMENT-REQUIRED header", 402, "PAYMENT_REQUIRED");
      const { payX402Challenge } = await import("../x402/buyer");
      const signature = await payX402Challenge(header, BigInt(cents) * 10_000n);
      res = await this.post(`/domain/create/${domain}`, body, {
        idem: idempotencyKey,
        signal,
        timeoutMs: 20000,
        headers: { "PAYMENT-SIGNATURE": signature },
      });
    }

    const r = obj(res.json);
    if (!res.ok || r.status !== "SUCCESS") {
      throw new ProviderError("porkbun", `create ${domain} failed (${res.status}): ${excerpt(String(r.message ?? res.text))}`, res.status, String(r.code ?? ""));
    }
    return { orderId: String(r.orderId ?? ""), cents: Number(r.cost ?? cents) };
  }

  /** `dryRun: true` checks everything the real create would (verification, spend limit, price) and charges nothing. */
  async rehearse(domain: string, cents: number, signal?: AbortSignal) {
    const body: Record<string, unknown> = { cost: cents, agreeToTerms: "yes", dryRun: true };
    if ((await this.methodFor(cents, signal)) === "usdc") body.payWith = "usdc";
    const res = await this.post(`/domain/create/${domain}`, body, { signal, timeoutMs: 6000 });
    const r = obj(res.json);
    // With payWith usdc a passing rehearsal may also answer 402 (terms only, nothing charged).
    if (res.status === 402 || (res.ok && r.status === "SUCCESS")) return;
    throw new ProviderError("porkbun", `registration would fail (${String(r.code ?? res.status)}): ${excerpt(String(r.message ?? res.text))}`, res.status, String(r.code ?? ""));
  }

  async setDns(domain: string, records: DnsRecord[], idempotencyKey: string, signal?: AbortSignal) {
    // New Porkbun registrations come with parking records (ALIAS @, CNAME *);
    // clear anything that would conflict with ours. Missing records are fine.
    const clear: [string, string][] = [
      ["ALIAS", ""],
      ["A", ""],
      ["CNAME", ""],
      ["CNAME", "www"],
      ["CNAME", "*"],
      ["A", "www"],
    ];
    await Promise.all(
      clear.map(([type, sub]) =>
        this.post(`/dns/deleteByNameType/${domain}/${type}${sub ? `/${sub}` : ""}`, {}, { signal, timeoutMs: 8000 }).catch(() => undefined),
      ),
    );
    const ids: string[] = [];
    for (const [i, rec] of records.entries()) {
      const res = await this.post(
        `/dns/create/${domain}`,
        { name: rec.name, type: rec.type, content: rec.content, ttl: 600 },
        { idem: `${idempotencyKey}:${i}`, signal, timeoutMs: 8000 },
      );
      const r = obj(res.json);
      if (!res.ok || r.status !== "SUCCESS") {
        throw new ProviderError("porkbun", `dns create ${rec.type} ${rec.name || "@"} failed (${res.status}): ${excerpt(String(r.message ?? res.text))}`, res.status, String(r.code ?? ""));
      }
      ids.push(String(r.id ?? ""));
    }
    return { ids };
  }
}

/** Snapshot of Porkbun first-year prices (2026-10-17) for offline/mock quotes. */
const MOCK_PRICES: Record<string, string> = { com: "11.08", co: "15.76", shop: "2.06", store: "2.57", net: "12.52", sh: "31.20" };

/**
 * Deterministic offline registrar: same name → same answer. Roughly one in
 * five names is "taken" so the UI and tests see both states.
 */
export class MockRegistrar implements Registrar {
  readonly name = "mock-registrar";
  readonly mock = true;
  readonly calls: string[] = [];
  readonly registered = new Set<string>();

  async check(domains: string[]): Promise<DomainCheck[]> {
    this.calls.push(`check:${domains.join(",")}`);
    return domains.map((domain) => {
      const tld = domain.split(".").pop() ?? "com";
      const priceUsd = MOCK_PRICES[tld] ?? "14.99";
      const ours = this.registered.has(domain);
      const taken = ours || stableIndex(`taken:${domain}`, 5) === 0;
      return { domain, available: !taken, priceUsd, cents: usdStringToCents(priceUsd), premium: false, inAccount: ours };
    });
  }

  /** Set to make the next rehearsals fail (tests). */
  rehearsalError: string | null = null;

  async rehearse(domain: string, cents: number) {
    this.calls.push(`rehearse:${domain}:${cents}`);
    if (this.rehearsalError) throw new Error(this.rehearsalError);
  }

  private readonly byKey = new Map<string, { orderId: string; cents: number }>();

  async register(domain: string, cents: number, idempotencyKey: string) {
    this.calls.push(`register:${domain}:${cents}`);
    const replay = this.byKey.get(idempotencyKey);
    if (replay) return replay; // same Idempotency-Key → original result, like Porkbun
    const tld = domain.split(".").pop() ?? "com";
    const expected = usdStringToCents(MOCK_PRICES[tld] ?? "14.99");
    if (cents !== expected) throw new ProviderError("mock-registrar", `price mismatch: quoted ${cents}, live ${expected}`, 400, "PRICE_MISMATCH");
    if (this.registered.has(domain)) throw new ProviderError("mock-registrar", `${domain} is not available`, 400, "DOMAIN_NOT_AVAILABLE");
    this.registered.add(domain);
    log.info("MOCK registrar registered domain", { domain, cents });
    const result = { orderId: `mock-order-${stableIndex(idempotencyKey, 1_000_000)}`, cents };
    this.byKey.set(idempotencyKey, result);
    return result;
  }

  async setDns(domain: string, records: DnsRecord[]) {
    this.calls.push(`dns:${domain}:${records.length}`);
    return { ids: records.map((_, i) => `mock-dns-${i}`) };
  }
}

export function makeRegistrar(): Registrar {
  const key = env.porkbunKey();
  const secret = env.porkbunSecret();
  if (key && secret) return new PorkbunRegistrar(key, secret, env.porkbunPayWith());
  return new MockRegistrar();
}
