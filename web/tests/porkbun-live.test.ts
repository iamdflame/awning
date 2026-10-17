import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PorkbunRegistrar } from "@/lib/adapters/registrar";

/**
 * Opt-in check against the real Porkbun API (dry runs only: nothing is
 * registered or charged). Run with PORKBUN_LIVE=1 and keys in the repo .env.
 */
const live = process.env.PORKBUN_LIVE === "1";
function rootEnv(): Record<string, string> {
  const text = readFileSync(path.resolve(import.meta.dirname, "../../.env"), "utf8");
  return Object.fromEntries(text.split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
}

describe.skipIf(!live)("Porkbun registrar (live dry runs)", () => {
  const env = live ? rootEnv() : {};
  const domain = "awningprobezz91.shop";

  it("auto pays in USDC when credit is short, and the rehearsal passes", async () => {
    const r = new PorkbunRegistrar(env.PORKBUN_API_KEY!, env.PORKBUN_SECRET_KEY!, "auto");
    const [c] = await r.check([domain]);
    expect(c!.available).toBe(true);
    await expect(r.rehearse(domain, c!.cents)).resolves.toBeUndefined();
  });

  it("credit-only with no balance is refused by the rehearsal", async () => {
    const r = new PorkbunRegistrar(env.PORKBUN_API_KEY!, env.PORKBUN_SECRET_KEY!, "credit");
    const [c] = await r.check([domain]);
    await expect(r.rehearse(domain, c!.cents)).rejects.toThrow(/insufficient credit|would fail/);
  });
});
