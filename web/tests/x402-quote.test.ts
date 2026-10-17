import { beforeEach, describe, expect, it } from "vitest";
import { MockRegistrar } from "@/lib/adapters/registrar";
import { MockTelephony } from "@/lib/adapters/telephony";
import { MockHosting } from "@/lib/adapters/hosting";
import { MockReceptionist } from "@/lib/adapters/receptionist";
import { USDC_BASE } from "@/lib/x402/constants";
import { TREASURY, buy, createPlan, decodeChallenge, freshWorld, openFree, openPaid, readJson, rows, tableCounts } from "./helpers";

describe("x402 402 challenges", () => {
  let world: Awaited<ReturnType<typeof freshWorld>>;
  beforeEach(async () => {
    world = await freshWorld();
  });

  it("open: 402 amount equals the plan's quoted totalUsd for the chosen domain, payTo = treasury", async () => {
    const plan = await createPlan();
    const dom = plan.domains.find((d: any) => d.available);
    expect(dom).toBeTruthy();
    expect(dom.totalUsd).toBeCloseTo(dom.priceUsd + 9, 6);

    const res = await openPaid(plan.planId, { domain: dom.domain, package: "pro" });
    expect(res.status).toBe(402);
    const ch = decodeChallenge(res);
    expect(ch.x402Version).toBe(2);
    expect(ch.accepts).toHaveLength(1);
    const a = ch.accepts[0]!;
    expect(a.scheme).toBe("exact");
    expect(a.network).toBe("eip155:8453");
    expect(a.asset).toBe(USDC_BASE);
    expect(a.payTo).toBe(TREASURY);
    expect(a.amount).toBe(dom.totalAtomic);
    expect(BigInt(a.amount)).toBe(BigInt(Math.round(dom.totalUsd * 100)) * 10_000n);
    expect(a.extra).toMatchObject({ name: "USD Coin", version: "2" });
    expect(ch.resource.url).toBe(`https://api.awning.sh/x402/open/${plan.planId}`);

    // v1-compatible body carries the same terms.
    const body = await readJson(res);
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0]).toMatchObject({ network: "base", maxAmountRequired: dom.totalAtomic, payTo: TREASURY, asset: USDC_BASE });
    expect(body.awning.totalUsd).toBe(dom.totalUsd);
  });

  it("open: defaults to the recommended domain; rejects domains not in the plan", async () => {
    const plan = await createPlan();
    const res = await openPaid(plan.planId, undefined);
    expect(res.status).toBe(402);
    const rec = plan.domains.find((d: any) => d.domain === plan.recommendedDomain);
    expect(decodeChallenge(res).accepts[0]!.amount).toBe(rec.totalAtomic);
    const bad = await openPaid(plan.planId, { domain: "not-in-plan.com", package: "pro" });
    expect(bad.status).toBe(400);
  });

  it("buy: 402 payTo is the owner's wallet and amount = price × qty", async () => {
    const owner = "0x1111111111111111111111111111111111111111";
    const plan = await createPlan(undefined, owner);
    expect((await openFree(plan.planId)).status).toBe(200);
    const offer = plan.business.offers[0];
    const res = await buy(plan.business.slug, offer.sku, { qty: 3 });
    expect(res.status).toBe(402);
    const a = decodeChallenge(res).accepts[0]!;
    expect(a.payTo).toBe(owner);
    expect(BigInt(a.amount)).toBe(BigInt(Math.round(offer.priceUsd * 100)) * 10_000n * 3n);
  });

  it("buy: a draft business cannot be bought from", async () => {
    const plan = await createPlan();
    const res = await buy(plan.business.slug, plan.business.offers[0].sku, {});
    expect(res.status).toBe(409);
  });

  it("unpaid requests have no side effects (DB, registrar, phone, hosting, receptionist)", async () => {
    const plan = await createPlan();
    await openFree(plan.planId); // a live business to buy from
    const plan2 = await createPlan("A bakery called Crumb & Co in Lisbon selling sourdough");
    const before = await tableCounts();
    const plansBefore = JSON.stringify(await rows("plans"));
    const reg = world.adapters.registrar as MockRegistrar;
    const tel = world.adapters.telephony as MockTelephony;
    const host = world.adapters.hosting as MockHosting;
    const rec = world.adapters.receptionist as MockReceptionist;
    const regCalls = reg.calls.length;

    for (let i = 0; i < 3; i++) {
      expect((await openPaid(plan2.planId, { domain: plan2.recommendedDomain, package: "pro" })).status).toBe(402);
      expect((await buy(plan.business.slug, plan.business.offers[0].sku, { qty: 2 })).status).toBe(402);
    }
    // Garbage payment header: still a 402, still nothing written.
    expect((await openPaid(plan2.planId, {}, { "PAYMENT-SIGNATURE": "bm90LWpzb24=" })).status).toBe(402);

    expect(await tableCounts()).toEqual(before);
    expect(JSON.stringify(await rows("plans"))).toBe(plansBefore);
    expect(reg.calls.length).toBe(regCalls);
    expect(tel.owned.size).toBe(0);
    expect(host.attached.size).toBe(0);
    expect(rec.agents.size).toBe(0);
    expect(world.facilitator.verifyCalls).toBe(0);
    expect(world.facilitator.settleCalls).toBe(0);
  });
});
