/**
 * Money is USDC on Base: 6 decimals. All arithmetic is done in atomic units
 * (bigint) and converted only at the edges. No floating point ever touches
 * a quoted or charged amount.
 */

export const USDC_DECIMALS = 6;
export const ATOMIC_PER_USD = 1_000_000n;
export const ATOMIC_PER_CENT = 10_000n;

/** Pro package service fee: first month of phone line + AI receptionist. */
export const PRO_FEE_ATOMIC = 9_000_000n; // $9.00

export const MAX_OFFER_ATOMIC = 10_000n * ATOMIC_PER_USD; // $10,000
export const MIN_OFFER_ATOMIC = ATOMIC_PER_CENT; // $0.01
export const MAX_QTY = 100;

const DECIMAL_RE = /^(\d{1,12})(?:\.(\d{1,6}))?$/;

/** "11.08" | 11.08 → 11080000n. Throws on anything that is not an exact ≤6-decimal amount. */
export function usdToAtomic(usd: string | number): bigint {
  const s = typeof usd === "number" ? numberToPlain(usd) : usd.trim();
  const m = DECIMAL_RE.exec(s);
  if (!m) throw new Error(`invalid USD amount: ${JSON.stringify(usd)}`);
  const whole = BigInt(m[1]!);
  const frac = BigInt((m[2] ?? "").padEnd(USDC_DECIMALS, "0"));
  return whole * ATOMIC_PER_USD + frac;
}

function numberToPlain(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid USD amount: ${n}`);
  // Round to 6 decimals first so binary artefacts (0.1 + 0.2) never leak in.
  const fixed = n.toFixed(USDC_DECIMALS);
  return fixed.replace(/\.?0+$/, "") || "0";
}

/** 20080000n → 20.08 (a JS number, exact for every amount we allow). */
export function atomicToUsd(atomic: bigint): number {
  return Number(atomicToUsdString(atomic));
}

/** 20080000n → "20.08"; 1234567n → "1.234567". Always at least 2 decimals. */
export function atomicToUsdString(atomic: bigint): string {
  if (atomic < 0n) throw new Error("negative amount");
  const whole = atomic / ATOMIC_PER_USD;
  let frac = (atomic % ATOMIC_PER_USD).toString().padStart(USDC_DECIMALS, "0");
  frac = frac.replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${whole}.${frac}`;
}

/** Registrar prices come as "11.08" dollars; registrars want integer cents. */
export function usdStringToCents(usd: string): number {
  const atomic = usdToAtomic(usd);
  if (atomic % ATOMIC_PER_CENT !== 0n) throw new Error(`sub-cent registrar price: ${usd}`);
  return Number(atomic / ATOMIC_PER_CENT);
}

export function centsToAtomic(cents: number): bigint {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`invalid cents: ${cents}`);
  return BigInt(cents) * ATOMIC_PER_CENT;
}

/** Pro opening price for a domain: domain's first-year price + $9.00 first month. */
export function proTotalAtomic(domainPriceAtomic: bigint): bigint {
  if (domainPriceAtomic <= 0n) throw new Error("domain price must be positive");
  return domainPriceAtomic + PRO_FEE_ATOMIC;
}

/** Offer price × qty, qty an integer in [1, MAX_QTY]. */
export function orderTotalAtomic(unitAtomic: bigint, qty: number): bigint {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error(`invalid qty: ${qty}`);
  if (unitAtomic <= 0n) throw new Error("unit price must be positive");
  return unitAtomic * BigInt(qty);
}

/** Offer prices are whole cents between $0.01 and $10,000. */
export function parseOfferPrice(usd: number | string): bigint {
  const atomic = usdToAtomic(usd);
  if (atomic % ATOMIC_PER_CENT !== 0n) throw new Error("price must be whole cents");
  if (atomic < MIN_OFFER_ATOMIC || atomic > MAX_OFFER_ATOMIC) throw new Error("price out of range ($0.01 – $10,000)");
  return atomic;
}
