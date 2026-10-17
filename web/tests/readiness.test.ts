import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { MockFacilitator, setFacilitatorForTests, type Facilitator } from "@/lib/x402/facilitator";
import { MockRegistrar } from "@/lib/adapters/registrar";
import { MockHosting } from "@/lib/adapters/hosting";
import { MockRefunder } from "@/lib/adapters/refunder";
import { buy, createPlan, freshWorld, newBuyer, openFree, openPaid, readJson, rows, signPayment } from "./helpers";

/** A mock adapter that reports itself as real (mock = false), to exercise readiness rules. */
function asReal<T extends object>(adapter: T): T {
  return Object.defineProperty(adapter, "mock", { value: false });
}

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
    expect(pro.unavailableReason).toMatch(/registrar, hosting, refunder/);
    const res = await openPaid(plan.planId, { domain: plan.recommendedDomain, package: "pro" });
    expect(res.status).toBe(503);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeNull();
    expect((await readJson(res)).missing).toEqual(["registrar", "hosting", "refunder"]);

    // Free opening and sales (payTo = owner) keep working.
    expect((await openFree(plan.planId)).status).toBe(200);
    expect((await buy(plan.business.slug, plan.business.offers[0].sku, {})).status).toBe(402);
  });

  it("without a real phone provider, Pro is sold as domain + hosting, says so, and provisions no phone", async () => {
    await freshWorld({ registrar: asReal(new MockRegistrar()), hosting: asReal(new MockHosting()), refunder: asReal(new MockRefunder()) });
    const facilitator = realLike();
    setFacilitatorForTests(facilitator);
    const plan = await createPlan();
    const pro = plan.packages.find((p: any) => p.id === "pro");
    expect(pro.available).toBe(true);
    expect(pro.phoneLine).toBe(false);
    expect(pro.includes.join(" ")).not.toMatch(/phone|receptionist/i);
    const body = { domain: plan.recommendedDomain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), newBuyer());
    const res = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(200);
    const out = await readJson(res);
    expect(out.business.status).toBe("live");
    expect(out.business.phone ?? null).toBeNull();
    const steps = Object.fromEntries(out.steps.map((s: any) => [s.name, s.status]));
    expect(steps).toMatchObject({ phone: "skipped", receptionist: "skipped", connect_phone: "skipped", hosting: "ok", register_domain: "ok" });
    expect(facilitator.inner.settleCalls).toBe(1);
    expect((await rows("payments"))[0].status).toBe("settled");
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
