import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmSchemeV1 } from "@x402/evm/exact/v1/client";
import { db, schema } from "@/lib/db/client";
import { buy, createPlan, freshWorld, newBuyer, openFree, openPaid, readJson, rows, signPayment } from "./helpers";

describe("x402 protocol compatibility and concurrency", () => {
  let world: Awaited<ReturnType<typeof freshWorld>>;
  beforeEach(async () => {
    world = await freshWorld();
  });

  it("accepts an x402 v1 payment (X-PAYMENT) built from the v1 body of the 402", async () => {
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const challenge = await buy(slug, sku, { qty: 1 });
    const v1 = await readJson(challenge);
    expect(v1.x402Version).toBe(1);
    const buyer = newBuyer();
    const client = x402Client.fromConfig({ schemes: [{ network: "base" as `${string}:${string}`, client: new ExactEvmSchemeV1(buyer), x402Version: 1 }], spendControls: false });
    const payload = await client.createPaymentPayload(v1);
    expect(payload.x402Version).toBe(1);
    const res = await buy(slug, sku, { qty: 1 }, { "X-PAYMENT": encodePaymentSignatureHeader(payload) });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-PAYMENT-RESPONSE")).toBeTruthy();
    const out = await readJson(res);
    expect(out.order.status).toBe("paid");
    expect(out.receipt.payer.toLowerCase()).toBe(buyer.address.toLowerCase());
  });

  it("a payment arriving while the plan is being opened is released, not burned", async () => {
    const plan = await createPlan();
    const body = { domain: plan.recommendedDomain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), newBuyer());
    const d = await db();
    await d.update(schema.plans).set({ status: "opening", updatedAt: new Date() }).where(eq(schema.plans.id, plan.planId));

    const busy = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(busy.status).toBe(409);
    expect((await readJson(busy)).error).toBe("open_in_progress");
    expect(await rows("payments")).toHaveLength(0); // key released
    expect(world.facilitator.settleCalls).toBe(0);

    // The other attempt gives up; the very same authorization now opens the business.
    await d.update(schema.plans).set({ status: "quoted" }).where(eq(schema.plans.id, plan.planId));
    const ok = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(ok.status).toBe(200);
    expect((await readJson(ok)).business.status).toBe("live");
    expect(world.facilitator.settleCalls).toBe(1);
  });

  it("an expired quote gets no challenge; a payment signed before expiry still completes within the grace window", async () => {
    const plan = await createPlan();
    const body = { domain: plan.recommendedDomain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), newBuyer());
    const d = await db();
    await d.update(schema.plans).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(schema.plans.id, plan.planId));
    expect((await openPaid(plan.planId, body)).status).toBe(410);
    const ok = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(ok.status).toBe(200);

    const plan2 = await createPlan("A candle shop called Wick & Wax");
    const sig2 = await signPayment(await openPaid(plan2.planId, { domain: plan2.recommendedDomain }), newBuyer());
    await d.update(schema.plans).set({ expiresAt: new Date(Date.now() - 20 * 60_000) }).where(eq(schema.plans.id, plan2.planId)); // past the 15-minute grace
    const late = await openPaid(plan2.planId, { domain: plan2.recommendedDomain }, { "PAYMENT-SIGNATURE": sig2 });
    expect(late.status).toBe(410);
    expect(world.facilitator.settleCalls).toBe(1);
  });
});
