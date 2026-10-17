import { describe, expect, it } from "vitest";
import { CATEGORIES, GENERAL } from "@/lib/plan/catalog";
import { contrast } from "@/lib/design/color";
import { ARCH, POSTER, SIGN, structureFor, themeFrom, type HeroKind } from "@/lib/design/theme";
import { agentPrompt, formatPhone, unitFor, verbFor } from "@/lib/design/storefront";
import { buildStreet, type RealShop } from "@/lib/design/street";

describe("storefront structure per category", () => {
  it("maps the API's labels onto the design's three structures", () => {
    expect(structureFor({ category: "Coffee & Tea" })).toBe(SIGN);
    expect(structureFor({ category: "Food & Catering" })).toBe(SIGN);
    expect(structureFor({ category: "Home Services" })).toBe(POSTER);
    expect(structureFor({ category: "Design & Creative" })).toBe(ARCH);
    expect(structureFor({ category: "Something new" })).toBe(ARCH); // the design's fallback
  });

  it("lets the business's own words win over a generic label", () => {
    expect(structureFor({ category: "Local Business", name: "Spoke & Chain", tagline: "Expert bike repair in Austin" })).toBe(POSTER);
    expect(structureFor({ category: "Shop & Handmade", name: "Barro Studio", tagline: "Handcrafted ceramics" })).toBe(ARCH);
    expect(structureFor({ category: "Local Business", name: "Ridge Roast", offers: [{ title: "Signature Roast Bag" }] })).toBe(SIGN);
  });
});

describe("themeFrom", () => {
  const palettes = [...CATEGORIES, GENERAL].flatMap((c) => c.palettes);
  const heroes: HeroKind[] = ["sign", "poster", "arch"];

  it("keeps every text pair readable for every catalog palette and structure", () => {
    for (const p of palettes)
      for (const h of heroes) {
        const t = themeFrom(p, h);
        expect(contrast(t.ink, t.ground), `${h} ink/ground ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(7);
        expect(contrast(t.onAccent, t.accent), `${h} button text ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accent, h === "sign" ? t.deep : t.ground), `${h} button edge ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(3);
      }
  });

  it("puts food on a dark field like the design's Ridge Roast and repair on a light one", () => {
    const coffee = themeFrom({ primary: "#6B3E26", accent: "#E2A04A", ink: "#2A1A12", paper: "#FBF5EE" }, "sign");
    expect(contrast(coffee.ground, "#000000")).toBeLessThan(contrast(coffee.ink, "#000000"));
    const repair = themeFrom({ primary: "#0B6E4F", accent: "#F2C14E", ink: "#0A2219", paper: "#F5F8F4" }, "poster");
    expect(repair.ground.toLowerCase()).toBe("#f2c14e");
  });

  it("survives a broken palette", () => {
    const t = themeFrom({ primary: "red", accent: "#zzz", ink: "#ffffff", paper: "#ffffff" }, "arch");
    expect(contrast(t.ink, t.ground)).toBeGreaterThanOrEqual(7);
  });
});

describe("storefront copy", () => {
  it("writes the exact sentence to give an agent", () => {
    expect(agentPrompt("booking", "Saturday tasting", "Ridge Roast", "ridgeroast.co")).toBe("Book a Saturday tasting at Ridge Roast (ridgeroast.co) and pay with PayBox.");
    expect(agentPrompt("product", "Small Glazed Bowl", "Barro Studio", "barro-studio.awning.sh")).toBe("Buy a small glazed bowl from Barro Studio (barro-studio.awning.sh) and pay with PayBox.");
    expect(agentPrompt("subscription", "Monthly coffee subscription", "Ridge Roast", "x.co")).toBe("Start a monthly coffee subscription with Ridge Roast (x.co) and pay with PayBox.");
    expect(agentPrompt("product", "Espresso Blend", "Kofi", "k.co")).toBe("Buy an espresso blend from Kofi (k.co) and pay with PayBox.");
  });

  it("names units and actions from the offer", () => {
    expect(unitFor("booking", "Saturday wheel class")).toBe("per person");
    expect(unitFor("subscription", "The monthly box")).toBe("per month");
    expect(unitFor("product", "Tejo bowl")).toBe("each");
    expect(verbFor("booking", "Full tune-up")).toBe("Book");
    expect(verbFor("product", "Volta Highlands, 250 g")).toBe("Buy");
  });

  it("formats phone numbers the local way", () => {
    expect(formatPhone("+17375550119")).toBe("+1 (737) 555-0119");
    expect(formatPhone("+233302900143")).toBe("+233 30 290 0143");
    expect(formatPhone("+351215550172")).toBe("+351 21 555 0172");
  });
});

describe("the Opened today street", () => {
  const real = (name: string, slug: string, lastSaleUsd: number | null = null): RealShop => ({
    slug,
    name,
    category: "Coffee & Tea",
    city: "Accra",
    url: `https://${slug}.awning.sh`,
    tagline: "Small-batch coffee",
    palette: { primary: "#6B3E26", accent: "#E2A04A", ink: "#2A1A12", paper: "#FBF5EE" },
    offers: [{ title: "Tasting", priceUsd: 5 }],
    openedAt: new Date().toISOString(),
    lastSaleUsd,
  });

  it("puts real shops first and fills the rest with examples that never claim sales", () => {
    const now = new Date();
    const street = buildStreet([real("Kofi Coffee", "kofi-coffee", 5)], now);
    expect(street).toHaveLength(7);
    expect(street[0]!.example).toBe(false);
    expect(street[0]!.tagLine).toBe("Last sale: $5");
    for (const s of street.slice(1)) {
      expect(s.example).toBe(true);
      expect(s.href).toBeNull();
      expect(s.tagTitle).toMatch(/^Example: /);
      expect(s.tagLine).not.toMatch(/sale|\$/i);
    }
  });

  it("never shows an example with the same name as a real shop, and only real shops when there are enough", () => {
    const now = new Date();
    expect(buildStreet([real("Ridge Roast", "ridge-roast")], now).filter((s) => s.name === "Ridge Roast")).toHaveLength(1);
    expect(buildStreet([real("Mama Efua's", "mama-efuas-kumasi")], now).filter((s) => /mama efua/i.test(s.name))).toHaveLength(1); // ’ vs '
    expect(buildStreet([real("Night Owl Records", "night-owl")], now).some((s) => s.example && s.name === "NIGHT OWL")).toBe(false);
    const many = Array.from({ length: 9 }, (_, i) => real(`Shop ${i}`, `shop-${i}`));
    expect(buildStreet(many, now).every((s) => !s.example)).toBe(true);
  });
});
