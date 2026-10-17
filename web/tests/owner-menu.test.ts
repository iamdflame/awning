import { beforeEach, describe, expect, it } from "vitest";
import { createPlan, freshWorld, newBuyer, openFree } from "./helpers";

const SENTENCE = "Open a business on Awning: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags at $14 and a $5 tasting session.";

describe("the owner's own menu", () => {
  beforeEach(async () => {
    await freshWorld();
  });

  it("an owner who priced two things gets exactly those two offers", async () => {
    const p = await createPlan(SENTENCE);
    const prices = p.business.offers.map((o: any) => o.priceUsd).sort((a: number, b: number) => a - b);
    expect(prices).toEqual([5, 14]);
  });

  it("a redraft by the same owner keeps the name and preview address; another owner gets a new one", async () => {
    const owner = newBuyer().address;
    const first = await createPlan(SENTENCE, owner);
    const again = await createPlan(SENTENCE, owner);
    expect(again.business.slug).toBe(first.business.slug);
    expect(again.previewUrl).toBe(first.previewUrl);
    const stranger = await createPlan(SENTENCE, newBuyer().address);
    expect(stranger.business.slug).not.toBe(first.business.slug);
  });

  it("an opened business is never replaced by a redraft", async () => {
    const owner = newBuyer().address;
    const first = await createPlan(SENTENCE, owner);
    await openFree(first.planId);
    const again = await createPlan(SENTENCE, owner);
    expect(again.business.slug).not.toBe(first.business.slug);
  });
});
