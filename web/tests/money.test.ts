import { describe, expect, it } from "vitest";
import {
  atomicToUsd,
  atomicToUsdString,
  centsToAtomic,
  orderTotalAtomic,
  parseOfferPrice,
  PRO_FEE_ATOMIC,
  proTotalAtomic,
  usdStringToCents,
  usdToAtomic,
} from "@/lib/money";

describe("quote amount math", () => {
  it("converts USD to atomic USDC exactly", () => {
    expect(usdToAtomic("11.08")).toBe(11_080_000n);
    expect(usdToAtomic(11.08)).toBe(11_080_000n);
    expect(usdToAtomic("0.000001")).toBe(1n);
    expect(usdToAtomic(0.1 + 0.2)).toBe(300_000n); // float artefact never leaks
    expect(usdToAtomic(100)).toBe(100_000_000n);
    expect(() => usdToAtomic("1.0000001")).toThrow();
    expect(() => usdToAtomic("-1")).toThrow();
    expect(() => usdToAtomic("1e3")).toThrow();
  });

  it("formats atomic amounts", () => {
    expect(atomicToUsdString(20_080_000n)).toBe("20.08");
    expect(atomicToUsdString(9_000_000n)).toBe("9.00");
    expect(atomicToUsdString(1_234_567n)).toBe("1.234567");
    expect(atomicToUsd(20_080_000n)).toBe(20.08);
  });

  it("pro = domain first-year price + $9.00, exactly, for every TLD we sell", () => {
    expect(PRO_FEE_ATOMIC).toBe(9_000_000n);
    for (const [price, total] of [
      ["11.08", "20.08"],
      ["15.76", "24.76"],
      ["2.06", "11.06"],
      ["2.57", "11.57"],
    ] as const) {
      const domainAtomic = centsToAtomic(usdStringToCents(price));
      expect(atomicToUsdString(proTotalAtomic(domainAtomic))).toBe(total);
      expect(proTotalAtomic(domainAtomic)).toBe(usdToAtomic(total));
    }
    expect(() => proTotalAtomic(0n)).toThrow();
  });

  it("order total = unit × qty with bounded integer qty", () => {
    expect(orderTotalAtomic(5_000_000n, 1)).toBe(5_000_000n);
    expect(orderTotalAtomic(1_990_000n, 3)).toBe(5_970_000n);
    expect(() => orderTotalAtomic(5_000_000n, 0)).toThrow();
    expect(() => orderTotalAtomic(5_000_000n, 1.5)).toThrow();
    expect(() => orderTotalAtomic(5_000_000n, 101)).toThrow();
  });

  it("offer prices are whole cents in range", () => {
    expect(parseOfferPrice(30)).toBe(30_000_000n);
    expect(parseOfferPrice("4.99")).toBe(4_990_000n);
    expect(() => parseOfferPrice("4.999")).toThrow();
    expect(() => parseOfferPrice(0)).toThrow();
    expect(() => parseOfferPrice(10_000.01)).toThrow();
  });
});
