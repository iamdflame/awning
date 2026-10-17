import { beforeEach, describe, expect, it } from "vitest";
import { buy, createPlan, freshWorld, newBuyer, openFree, openPaid, readJson, rows, signPayment } from "./helpers";

describe("idempotency of paid retries", () => {
  let world: Awaited<ReturnType<typeof freshWorld>>;
  beforeEach(async () => {
    world = await freshWorld();
  });

  it("the same payment twice → one order, one settlement, identical response", async () => {
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const buyer = newBuyer();

    const challenge = await buy(slug, sku, { qty: 2, buyerNote: "hello" });
    const sig = await signPayment(challenge, buyer);

    const r1 = await buy(slug, sku, { qty: 2, buyerNote: "hello" }, { "PAYMENT-SIGNATURE": sig });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("PAYMENT-RESPONSE")).toBeTruthy();
    const b1 = await readJson(r1);
    expect(b1.order.status).toBe("paid");
    expect(b1.order.qty).toBe(2);
    expect(b1.receipt.payer.toLowerCase()).toBe(buyer.address.toLowerCase());
    expect(b1.fulfillment.code).toBeTruthy();

    const r2 = await buy(slug, sku, { qty: 2, buyerNote: "hello" }, { "PAYMENT-SIGNATURE": sig });
    expect(r2.status).toBe(200);
    const b2 = await readJson(r2);
    expect(b2.order.id).toBe(b1.order.id);
    expect(b2).toEqual(b1);

    expect(world.facilitator.settleCalls).toBe(1);
    const orders = await rows("orders");
    expect(orders).toHaveLength(1);
    const events = (await rows("events")).filter((e) => e.type === "order");
    expect(events).toHaveLength(1);
    const [biz] = (await rows("businesses")).filter((b) => b.slug === slug);
    expect(biz.sales_count).toBe(1);

    // A second, different payment is a second order.
    const sig2 = await signPayment(await buy(slug, sku, {}), buyer);
    const r3 = await buy(slug, sku, {}, { "PAYMENT-SIGNATURE": sig2 });
    expect(r3.status).toBe(200);
    expect((await readJson(r3)).order.id).not.toBe(b1.order.id);
    expect(await rows("orders")).toHaveLength(2);
  });

  it("a payment for the wrong amount is refused and records nothing", async () => {
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const sig = await signPayment(await buy(slug, sku, { qty: 1 }), newBuyer());
    const res = await buy(slug, sku, { qty: 2 }, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(402);
    expect((await readJson(res)).error).toBe("amount_mismatch");
    expect(await rows("orders")).toHaveLength(0);
    expect(await rows("payments")).toHaveLength(0);
    expect(world.facilitator.settleCalls).toBe(0);
  });

  it("a forged signature is refused by verification", async () => {
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const sig = await signPayment(await buy(slug, sku, {}), newBuyer());
    const decoded = JSON.parse(Buffer.from(sig, "base64").toString());
    decoded.payload.authorization.from = newBuyer().address; // claim someone else's funds
    const forged = Buffer.from(JSON.stringify(decoded)).toString("base64");
    const res = await buy(slug, sku, {}, { "PAYMENT-SIGNATURE": forged });
    expect(res.status).toBe(402);
    expect((await readJson(res)).error).toMatch(/signature/);
    expect(await rows("orders")).toHaveLength(0);
  });

  it("open is idempotent by plan: replay returns the same result; a second payment is never settled", async () => {
    const plan = await createPlan();
    const payer = newBuyer();
    const other = newBuyer();
    const body = { domain: plan.recommendedDomain, package: "pro" };
    // Three authorizations signed while the plan is still quoted.
    const sig = await signPayment(await openPaid(plan.planId, body), payer);
    const sigSamePayer = await signPayment(await openPaid(plan.planId, body), payer);
    const sigOther = await signPayment(await openPaid(plan.planId, body), other);

    const r1 = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    const b1 = await readJson(r1);
    expect(r1.status).toBe(200);
    expect(b1.business.status).toBe("live");
    expect(b1.business.domain).toBe(plan.recommendedDomain);
    expect(b1.business.phone).toMatch(/^\+1202555/);
    expect(b1.ownerToken).toMatch(/^awn_ot_/);
    expect(b1.steps.map((s: any) => s.name)).toEqual(["preflight", "phone", "receptionist", "connect_phone", "hosting", "register_domain", "dns", "go_live"]);
    expect(b1.receipts.paidUsd).toBe(plan.domains.find((d: any) => d.domain === plan.recommendedDomain).totalUsd);

    const r2 = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(await readJson(r2)).toEqual(b1);
    expect(world.facilitator.settleCalls).toBe(1);

    // Same payer, another payment (e.g. their agent lost the first response): not charged, token recovered.
    const r3 = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sigSamePayer });
    const b3 = await readJson(r3);
    expect(r3.status).toBe(200);
    expect(b3.alreadyOpen).toBe(true);
    expect(b3.charged).toBe(false);
    expect(b3.ownerToken).toBe(b1.ownerToken);
    expect(r3.headers.get("PAYMENT-RESPONSE")).toBeNull();

    // Someone else paying for the same plan: not charged, and no owner token.
    const r4 = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sigOther });
    const b4 = await readJson(r4);
    expect(b4.alreadyOpen).toBe(true);
    expect(b4.charged).toBe(false);
    expect(b4.ownerToken).toBeUndefined();
    expect(world.facilitator.settleCalls).toBe(1);

    // Once open, an unpaid request gets no challenge to pay.
    expect((await openPaid(plan.planId, body)).status).toBe(409);
    expect((await rows("events")).filter((e) => e.type === "opened")).toHaveLength(1);
    const payments = await rows("payments");
    expect(payments.map((p) => p.status).sort()).toEqual(["settled", "superseded", "superseded"]);
  });
});
