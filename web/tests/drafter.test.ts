import { afterEach, describe, expect, it } from "vitest";
import type { BusinessDraft, DraftInput, Drafter } from "@/lib/adapters/types";
import { MockRegistrar } from "@/lib/adapters/registrar";
import { contrast } from "@/lib/adapters/drafter";
import { createPlan, freshWorld } from "./helpers";

class FakeLLM implements Drafter {
  readonly name = "fake-llm";
  readonly mock = false;
  calls = 0;
  constructor(private readonly make: (input: DraftInput) => BusinessDraft, private readonly delayMs = 0) {}
  async draft(input: DraftInput, signal?: AbortSignal): Promise<BusinessDraft> {
    this.calls++;
    if (this.delayMs) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, this.delayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    }
    return this.make(input);
  }
}

const llmDraft = (name: string): BusinessDraft => ({
  name,
  tagline: "Coffee roasted on the ridge",
  description: "Small-batch coffee from Accra. Order bags or book a tasting.",
  category: "Coffee & Tea",
  city: "Accra",
  palette: { primary: "#ffff00", accent: "#00ff00", ink: "#eeeeee", paper: "#ffffff" }, // unreadable: must be replaced
  offers: [
    { title: "Bag of beans", description: "250 g", priceUsd: 15.999, kind: "product" },
    { title: "Bag of beans", description: "duplicate", priceUsd: 15, kind: "product" },
  ],
});

describe("LLM drafter integration", () => {
  afterEach(() => {
    delete process.env.AWNING_LLM_TIMEOUT_MS;
  });

  it("uses the LLM draft but enforces the rules (stated prices, 3+ offers, readable palette, cents)", async () => {
    const llm = new FakeLLM(() => llmDraft("Ridge Roast"));
    await freshWorld({ drafter: llm });
    const p = await createPlan();
    expect(llm.calls).toBe(1);
    expect(p.business.name).toBe("Ridge Roast");
    expect(p.business.tagline).toBe("Coffee roasted on the ridge");
    const prices = p.business.offers.map((o: any) => o.priceUsd);
    expect(prices).toContain(5); // the owner's "$5 tasting session" survives
    expect(prices).toContain(16); // 15.999 → whole cents
    expect(p.business.offers.length).toBeGreaterThanOrEqual(3);
    expect(new Set(p.business.offers.map((o: any) => o.title)).size).toBe(p.business.offers.length);
    expect(contrast(p.business.palette.ink, p.business.palette.paper)).toBeGreaterThanOrEqual(7);
  });

  it("checks the LLM's own domains when it renames the business", async () => {
    const registrar = new MockRegistrar();
    await freshWorld({ drafter: new FakeLLM(() => llmDraft("Highland Beans")), registrar });
    const p = await createPlan();
    expect(p.business.name).toBe("Highland Beans");
    expect(p.domains.every((d: any) => d.domain.startsWith("highlandbeans") || d.domain.includes("highlandbeans"))).toBe(true);
    expect(registrar.calls.filter((c) => c.startsWith("check:"))).toHaveLength(2);
  });

  it("falls back to the template when the LLM is slower than its budget", async () => {
    process.env.AWNING_LLM_TIMEOUT_MS = "200";
    await freshWorld({ drafter: new FakeLLM(() => llmDraft("Too Late Coffee"), 2000) });
    const t0 = Date.now();
    const p = await createPlan();
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(p.business.name).toBe("Ridge Roast");
  });

  it("falls back to the template when the LLM errors", async () => {
    await freshWorld({
      drafter: new FakeLLM(() => {
        throw new Error("overloaded");
      }),
    });
    const p = await createPlan();
    expect(p.business.name).toBe("Ridge Roast");
  });
});
