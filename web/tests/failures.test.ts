import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { MockRegistrar } from "@/lib/adapters/registrar";
import { MockTelephony } from "@/lib/adapters/telephony";
import { MockHosting } from "@/lib/adapters/hosting";
import { MockReceptionist } from "@/lib/adapters/receptionist";
import { MockRefunder } from "@/lib/adapters/refunder";
import { db, schema } from "@/lib/db/client";
import { buy, createPlan, freshWorld, newBuyer, openFree, openPaid, readJson, rows, signPayment } from "./helpers";

class FailingRegistrar extends MockRegistrar {
  override async register(): Promise<{ orderId: string; cents: number }> {
    this.calls.push("register:fail");
    throw new Error("registry refused the registration");
  }
}

class FailingTelephony extends MockTelephony {
  override async buy(): Promise<{ sid: string; number: string }> {
    throw new Error("no numbers available in this region");
  }
}

describe("failure before settlement moves no money", () => {
  it("a provider failure mid-saga compensates every completed step and never settles", async () => {
    const registrar = new FailingRegistrar();
    const telephony = new MockTelephony();
    const hosting = new MockHosting();
    const receptionist = new MockReceptionist();
    const world = await freshWorld({ registrar, telephony, hosting, receptionist });
    const plan = await createPlan();
    const body = { domain: plan.recommendedDomain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), newBuyer());

    const res = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(502);
    expect(res.headers.get("PAYMENT-RESPONSE")).toBeNull();
    const out = await readJson(res);
    expect(out).toMatchObject({ error: "provisioning_failed", charged: false, refunded: false, failedStep: "register_domain" });
    const byName = Object.fromEntries(out.steps.map((s: any) => [s.name, s.status]));
    expect(byName).toMatchObject({ preflight: "ok", phone: "compensated", receptionist: "compensated", hosting: "compensated", register_domain: "failed" });

    expect(world.facilitator.settleCalls).toBe(0);
    expect(telephony.owned.size).toBe(0); // number released
    expect(receptionist.agents.size).toBe(0); // agent deleted
    expect(hosting.attached.size).toBe(0); // domain detached
    const [p] = await rows("plans");
    expect(p.status).toBe("quoted"); // can be retried with a new payment
    const [b] = await rows("businesses");
    expect(b.status).toBe("draft");
    expect((await rows("events")).filter((e) => e.type === "opened")).toHaveLength(0);
    const [pay] = await rows("payments");
    expect(pay.status).toBe("failed");
    expect(pay.tx).toBeNull();

    // Retrying the same failed authorization replays the failure; still nothing settles.
    const again = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(again.status).toBe(502);
    expect(world.facilitator.settleCalls).toBe(0);
  });

  it("a failure at the first provider step leaves nothing behind", async () => {
    const world = await freshWorld({ telephony: new FailingTelephony() });
    const plan = await createPlan();
    const body = { domain: plan.recommendedDomain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), newBuyer());
    const res = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(502);
    expect((await readJson(res)).failedStep).toBe("phone");
    expect(world.facilitator.settleCalls).toBe(0);
    expect((world.adapters.registrar as MockRegistrar).calls.some((c) => c.startsWith("register:"))).toBe(false);
  });

  it("a settlement failure undoes the work and reports an honest 402", async () => {
    const world = await freshWorld();
    world.facilitator.failSettleWith = "insufficient_funds";
    const plan = await createPlan();
    await openFree(plan.planId);
    const { slug } = plan.business;
    const sku = plan.business.offers[0].sku;
    const sig = await signPayment(await buy(slug, sku, {}), newBuyer());
    const res = await buy(slug, sku, {}, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(402);
    expect(await readJson(res)).toMatchObject({ error: "settlement_failed", charged: false });
    const [order] = await rows("orders");
    expect(order.status).toBe("failed");
    expect((await rows("events")).filter((e) => e.type === "order")).toHaveLength(0);
  });
});

describe("failure discovered after settlement is refunded", () => {
  let world: Awaited<ReturnType<typeof freshWorld>>;
  let refunder: MockRefunder;
  beforeEach(async () => {
    refunder = new MockRefunder();
    world = await freshWorld({ refunder });
  });

  it("commit fails after settle → compensate + USDC refund from treasury", async () => {
    const plan = await createPlan();
    const domain = plan.recommendedDomain as string;
    // Sabotage the final commit: another business already claims this domain (unique index).
    const d = await db();
    const plan2 = await createPlan("Tutoring in Accra called Bright Minds");
    await d.update(schema.businesses).set({ domain }).where(eq(schema.businesses.slug, plan2.business.slug));

    const payer = newBuyer();
    const body = { domain, package: "pro" };
    const sig = await signPayment(await openPaid(plan.planId, body), payer);
    const res = await openPaid(plan.planId, body, { "PAYMENT-SIGNATURE": sig });
    expect(res.status).toBe(502);
    const out = await readJson(res);
    expect(out.refunded).toBe(true);
    expect(out.refundTx).toMatch(/^0x[0-9a-f]{64}$/);
    // The payer sees what happened; the internal cause stays in the payment row and the log.
    expect(out.reason).toBe("Your payment settled but the result could not be recorded.");
    expect(JSON.stringify(out)).not.toMatch(/commit failed|duplicate|unique|constraint/i);
    expect(world.facilitator.settleCalls).toBe(1);
    expect(refunder.refunds).toHaveLength(1);
    expect(refunder.refunds[0]!.to.toLowerCase()).toBe(payer.address.toLowerCase());
    expect(refunder.refunds[0]!.amountAtomic).toBe(BigInt(plan.domains.find((x: any) => x.domain === domain).totalAtomic));
    const pay = (await rows("payments"))[0];
    expect(pay.status).toBe("refunded");
    expect(pay.error).toMatch(/commit failed after settlement/);
    expect((world.adapters.telephony as MockTelephony).owned.size).toBe(0);
  });
});
