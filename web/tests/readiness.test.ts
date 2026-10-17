import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { MockFacilitator, setFacilitatorForTests, type Facilitator } from "@/lib/x402/facilitator";
import { buy, createPlan, freshWorld, newBuyer, openFree, openPaid, readJson, signPayment } from "./helpers";

/** Behaves like a real facilitator (mock = false) but verifies locally. */
function realLike(inner = new MockFacilitator()): Facilitator & { inner: MockFacilitator } {
  return {
    name: "real-like",
    mock: false,
    inner,
    verify: (p, r) => inner.verify(p, r),
    settle: (p, r) => inner.settle(p, r),
    authorizationUsed: (a) => inner.authorizationUsed(a),
  };
}

describe("real money never buys simulated provisioning", () => {
  it("with a real facilitator and mock providers, Pro is not offered and no challenge is issued", async () => {
    await freshWorld();
    setFacilitatorForTests(realLike());
    const plan = await createPlan();
    const pro = plan.packages.find((p: any) => p.id === "pro");
    expect(pro.available).toBe(false);
    expect(pro.unavailableReason).toMatch(/registrar, hosting, telephony, receptionist/);
    const res = await openPaid(plan.planId, { domain: plan.recommendedDomain, package: "pro" });
    expect(res.status).toBe(503);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeNull();
    expect((await readJson(res)).missing).toEqual(["registrar", "hosting", "telephony", "receptionist", "refunder"]);

    // Free opening and sales (payTo = owner) keep working.
    expect((await openFree(plan.planId)).status).toBe(200);
    expect((await buy(plan.business.slug, plan.business.offers[0].sku, {})).status).toBe(402);
  });

  it("a completed payment replays even after the quote can no longer be computed", async () => {
    const world = await freshWorld();
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const sig = await signPayment(await buy(slug, sku, {}), newBuyer());
    const first = await readJson(await buy(slug, sku, {}, { "PAYMENT-SIGNATURE": sig }));
    expect(first.order.status).toBe("paid");
    // The owner removes the offer; the buyer's agent retries the same paid request.
    const d = await db();
    await d.update(schema.offers).set({ active: false }).where(eq(schema.offers.sku, sku));
    const again = await buy(slug, sku, {}, { "PAYMENT-SIGNATURE": sig });
    expect(again.status).toBe(200);
    expect((await readJson(again)).order.id).toBe(first.order.id);
    expect(world.facilitator.settleCalls).toBe(1);
  });
});
