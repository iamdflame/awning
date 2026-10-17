import { beforeEach, describe, expect, it } from "vitest";
import { resolveHost, rewriteTarget } from "@/lib/host";
import { templateDraft, detectName, detectCity, detectPricedOffers } from "@/lib/plan/template";
import { finalizeDraft } from "@/lib/adapters/drafter";
import { createPlan, freshWorld } from "./helpers";

describe("plan generation (template drafter + mock registrar)", () => {
  beforeEach(async () => {
    await freshWorld();
  });

  it("returns the contract shape with exact per-domain totals", async () => {
    const p = await createPlan();
    expect(p.planId).toMatch(/^pln_/);
    expect(new Date(p.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(p.business).toMatchObject({ name: "Ridge Roast", slug: "ridge-roast", city: "Accra", status: "draft", category: "Coffee & Tea" });
    expect(p.business.description.split(/(?<=\.)\s/).length).toBeGreaterThanOrEqual(2);
    expect(p.business.offers.length).toBeGreaterThanOrEqual(3);
    expect(p.business.offers.length).toBeLessThanOrEqual(5);
    expect(p.business.offers.some((o: any) => o.priceUsd === 5 && /tasting/i.test(o.title))).toBe(true);
    for (const c of ["primary", "accent", "ink", "paper"]) expect(p.business.palette[c]).toMatch(/^#[0-9A-F]{6}$/);
    expect(p.previewUrl).toBe("https://ridge-roast.awning.sh");
    expect(p.domains).toHaveLength(3);
    for (const d of p.domains) {
      expect(d.domain).toMatch(/^[a-z0-9]+\.[a-z]+$/);
      if (d.available) expect(Math.round(d.totalUsd * 100)).toBe(Math.round(d.priceUsd * 100) + 900);
      else expect(d.totalUsd).toBeNull();
    }
    expect(p.packages.map((x: any) => x.id)).toEqual(["free", "pro"]);
    expect(p.packages[0].priceUsd).toBe(0);
    const rec = p.domains.find((d: any) => d.domain === p.recommendedDomain);
    expect(p.packages[1].priceUsd).toBe(rec.totalUsd);
  });

  it("allocates a unique slug for a second business with the same name", async () => {
    const a = await createPlan();
    const b = await createPlan();
    expect(a.business.slug).toBe("ridge-roast");
    expect(b.business.slug).toBe("ridge-roast-accra");
  });
});

describe("template drafter", () => {
  it("extracts name, city and stated prices", () => {
    const s = "Start a business: Ridge Roast — small-batch coffee from Accra, ship bags and sell a $5 tasting session.";
    expect(detectName(s)).toBe("Ridge Roast");
    expect(detectCity(s)).toBe("Accra");
    expect(detectPricedOffers(s)).toEqual([expect.objectContaining({ title: "Tasting Session", priceUsd: 5, kind: "booking" })]);
    expect(detectName("I want to open a bakery called Crumb & Co in Lisbon")).toBe("Crumb & Co");
    expect(detectPricedOffers("braids for $85 and lash fills for $40")).toHaveLength(2);
  });

  it("is deterministic and always yields 3–5 sane offers", () => {
    for (const s of ["dog walking in Austin", "I teach piano", "Handmade candles", "x", "Accounting for small businesses in Lagos, $75 strategy call"]) {
      const a = finalizeDraft(templateDraft({ sentence: s }), { sentence: s });
      const b = finalizeDraft(templateDraft({ sentence: s }), { sentence: s });
      expect(a).toEqual(b);
      expect(a.offers.length).toBeGreaterThanOrEqual(3);
      expect(a.offers.length).toBeLessThanOrEqual(5);
      for (const o of a.offers) {
        expect(o.priceUsd).toBeGreaterThanOrEqual(1);
        expect(o.priceUsd).toBeLessThanOrEqual(10000);
      }
    }
  });
});

describe("host routing", () => {
  const root = "awning.sh";
  it("maps hosts to tenants", () => {
    expect(resolveHost("awning.sh", root)).toEqual({ kind: "root" });
    expect(resolveHost("www.awning.sh", root)).toEqual({ kind: "root" });
    expect(resolveHost("api.awning.sh", root)).toEqual({ kind: "root" });
    expect(resolveHost("localhost:3000", root)).toEqual({ kind: "root" });
    expect(resolveHost("awning-web.vercel.app", root)).toEqual({ kind: "root" });
    expect(resolveHost("ridge-roast.awning.sh", root)).toEqual({ kind: "subdomain", slug: "ridge-roast" });
    expect(resolveHost("ridge-roast.localhost:3000", root)).toEqual({ kind: "subdomain", slug: "ridge-roast" });
    expect(resolveHost("www.ridgeroast.co", root)).toEqual({ kind: "custom", domain: "ridgeroast.co" });
  });
  it("rewrites only storefront roots; API paths pass through on every host", () => {
    const q = new URLSearchParams("b=ridge-roast");
    expect(rewriteTarget({ kind: "root" }, "/", q)).toBe("/s/ridge-roast");
    expect(rewriteTarget({ kind: "root" }, "/", new URLSearchParams())).toBeNull();
    expect(rewriteTarget({ kind: "subdomain", slug: "ridge-roast" }, "/", new URLSearchParams())).toBe("/s/ridge-roast");
    expect(rewriteTarget({ kind: "custom", domain: "ridgeroast.co" }, "/", new URLSearchParams())).toBe("/s/ridgeroast.co");
    expect(rewriteTarget({ kind: "custom", domain: "ridgeroast.co" }, "/x402/b/ridge-roast/bag", new URLSearchParams())).toBeNull();
    expect(rewriteTarget({ kind: "subdomain", slug: "a" }, "/v1/health", new URLSearchParams())).toBeNull();
  });
});
