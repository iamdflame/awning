import { beforeEach, describe, expect, it } from "vitest";
import { POST as planPOST } from "@/app/v1/plan/route";
import { PLUGIN_KEY, addOffer, buy, createPlan, freshWorld, newBuyer, openFree, orders, readJson, signPayment } from "./helpers";

describe("owner-token auth", () => {
  beforeEach(async () => {
    await freshWorld();
  });

  it("plugin endpoints reject a missing or wrong plugin key", async () => {
    const mk = (headers: Record<string, string>) =>
      planPOST(new Request("https://api.awning.sh/v1/plan", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ sentence: "A bakery", ownerWallet: newBuyer().address }) }));
    expect((await mk({})).status).toBe(401);
    expect((await mk({ "x-awning-plugin-key": "nope" })).status).toBe(401);
    expect((await mk({ "x-awning-plugin-key": PLUGIN_KEY })).status).toBe(201);
  });

  it("orders and add-offer require the owner token of that business", async () => {
    const a = await createPlan();
    const b = await createPlan("A dog walking business called Happy Tails in Austin");
    const tokenA = (await readJson(await openFree(a.planId))).ownerToken as string;
    const tokenB = (await readJson(await openFree(b.planId))).ownerToken as string;
    expect(tokenA).toMatch(/^awn_ot_/);
    expect(tokenA).not.toBe(tokenB);

    // one paid order on A
    const sku = a.business.offers[0].sku;
    const sig = await signPayment(await buy(a.business.slug, sku, {}), newBuyer());
    expect((await buy(a.business.slug, sku, { buyerContact: "sam@example.com" }, { "PAYMENT-SIGNATURE": sig })).status).toBe(200);

    const slug = a.business.slug;
    expect((await orders(slug, {})).status).toBe(401); // no plugin key
    expect((await orders(slug, { "x-awning-plugin-key": PLUGIN_KEY })).status).toBe(401); // no owner token
    expect((await orders(slug, { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": "awn_ot_forged" })).status).toBe(403);
    expect((await orders(slug, { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": tokenB })).status).toBe(403); // other business's token
    const ok = await orders(slug, { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": tokenA });
    expect(ok.status).toBe(200);
    const list = (await readJson(ok)).orders;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ sku, qty: 1, status: "paid", buyerContact: "sam@example.com" });
    expect(Object.keys(list[0])).toEqual(expect.arrayContaining(["id", "sku", "qty", "totalUsd", "status", "createdAt", "tx", "payer", "buyerNote", "buyerContact"]));

    const offer = { title: "Monthly subscription box", description: "A box every month", priceUsd: 30, kind: "subscription" };
    expect((await addOffer(slug, offer, { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": tokenB })).status).toBe(403);
    const added = await addOffer(slug, offer, { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": tokenA });
    expect(added.status).toBe(201);
    const body = await readJson(added);
    expect(body.offer).toMatchObject({ sku: "monthly-subscription-box", priceUsd: 30, kind: "subscription" });
    expect(body.offers.some((o: any) => o.sku === "monthly-subscription-box")).toBe(true);

    // The new offer is buyable immediately at its exact price.
    const ch = await buy(slug, "monthly-subscription-box", {});
    expect(ch.status).toBe(402);
  });

  it("re-opening for free is idempotent and returns the same owner token", async () => {
    const a = await createPlan();
    const t1 = (await readJson(await openFree(a.planId))).ownerToken;
    const r2 = await readJson(await openFree(a.planId));
    expect(r2.alreadyOpen).toBe(true);
    expect(r2.ownerToken).toBe(t1);
  });
});
