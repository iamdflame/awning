import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Random id with ~128 bits of entropy: `pln_3k9x…`. */
export function newId(prefix: string, bytes = 16): string {
  const buf = randomBytes(bytes);
  let n = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 36n)] + out;
    n /= 36n;
  }
  return `${prefix}_${out.padStart(Math.ceil((bytes * 8) / Math.log2(36)), "0")}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Short human code derived from an id, e.g. for order confirmation codes. */
export function shortCode(id: string, len = 8): string {
  const h = sha256Hex(id);
  const n = BigInt("0x" + h.slice(0, 16));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let x = n;
  for (let i = 0; i < len; i++) {
    out += alphabet[Number(x % 32n)];
    x /= 32n;
  }
  return out;
}

/** Deterministic small integer from a string (palette/persona choice in templates). */
export function stableIndex(input: string, modulo: number): number {
  const h = sha256Hex(input);
  return Number(BigInt("0x" + h.slice(0, 12)) % BigInt(modulo));
}
