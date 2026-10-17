import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screenName, screenText } from "@/lib/policy";
import { recentAlerts } from "@/lib/ops/alert";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { POST as planPOST } from "@/app/v1/plan/route";
import { POST as reportPOST } from "@/app/v1/reports/route";
import { POST as adminPOST } from "@/app/v1/admin/businesses/[slug]/status/route";
import { GET as businessGET } from "@/app/v1/businesses/[slug]/route";
import { GET as liveGET } from "@/app/v1/live/route";
import { API, PLUGIN_KEY, addOffer, buy, createPlan, freshWorld, newBuyer, openFree, readJson, tableCounts } from "./helpers";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

async function plan(sentence: string, ownerWallet = newBuyer().address) {
  return planPOST(post("/v1/plan", { sentence, ownerWallet }, { "x-awning-plugin-key": PLUGIN_KEY }));
}

async function report(slug: string, ip: string, reason = "phishing") {
  return reportPOST(post("/v1/reports", { slug, reason, details: "asked me for my recovery phrase" }, { "x-forwarded-for": ip }));
}

describe("acceptable use screening", () => {
  it.each([
    ["Start a business selling handguns and ammunition in Austin", "weapons"],
    ["Weed delivery and THC gummies in Denver", "drugs"],
    ["An online casino with sports betting", "gambling"],
    ["Crypto investment plan with guaranteed returns, double your bitcoin", "financial_scheme"],
    ["Wallet recovery desk: verify your wallet with your seed phrase", "phishing"],
    ["Fake IDs and replica watches shipped worldwide", "counterfeit"],
    ["Hacker for hire, we hack instagram accounts", "hacking"],
    ["Official IRS agent office for tax refund claims", "impersonation"],
    ["Escort service in Lisbon", "adult"],
    ["Disposable vapes and nicotine pouches", "tobacco"],
  ])("blocks %s", (sentence, category) => {
    const r = screenText(sentence);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.category).toBe(category);
  });

  it.each([
    "Start a business: Ridge Roast, small-batch coffee from Accra, ship bags and sell a $5 tasting session.",
    "Bike repair shop in Austin: flat fixes, tune-ups and a monthly maintenance plan",
    "Ceramics studio in Lisbon selling nude-glaze cups and an investment piece vase",
    "Computer repair: virus and malware removal, screen replacement",
    "Glue gun workshop for kids, and a heat gun for vinyl wraps",
    "Pottery class presale tickets and replicas of ancient Roman lamps",
    "Hair braiding salon in Lagos, we accept M-Pesa, PayPal and cash",
    "Craft brewery taproom with a happy hour",
  ])("allows %s", (sentence) => {
    expect(screenText(sentence)).toEqual({ ok: true });
  });

  it.each(["PayPal Support Desk", "Coinbase Wallet Recovery", "M00nPay Help", "paypalsupport", "Bank of America Rewards", "Apple ID Support", "Amazon Refunds", "Trust Wallet"])(
    "flags brand impersonation in the name: %s",
    (name) => {
      const r = screenName(name);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.category).toBe("impersonation");
    },
  );

  it.each(["Pineapple Bakery", "Apple Tree Bakery", "Square One Coffee", "Striped Socks Co", "Open Air Market", "Robin Hood Archery", "Santander Surf School", "Fresh Cash Apples", "Delta Bike Services"])(
    "does not flag ordinary names: %s",
    (name) => {
      expect(screenName(name)).toEqual({ ok: true });
    },
  );
});

describe("plan, offer and open guards", () => {
  beforeEach(async () => {
    await freshWorld();
  });
  afterEach(() => {
    delete process.env.AWNING_PLAN_LIMIT_PER_HOUR;
    delete process.env.AWNING_FREE_OPENS_PER_DAY;
    delete process.env.AWNING_ADMIN_KEY;
  });

  it("refuses a prohibited plan with 422 and stores nothing", async () => {
    const before = await tableCounts();
    const res = await plan("Start a business selling fake passports and fake IDs");
    expect(res.status).toBe(422);
    const body = await readJson(res);
    expect(body).toMatchObject({ error: "policy_blocked", category: "counterfeit" });
    expect(body.message).toMatch(/Nothing was created or charged/);
    expect(await tableCounts()).toEqual(before);
  });

  it("refuses a business named after a brand it is not", async () => {
    const res = await plan("Start a business: PayPal Support Desk, help customers with their accounts");
    expect(res.status).toBe(422);
    expect(await readJson(res)).toMatchObject({ error: "policy_blocked", category: "impersonation" });
  });

  it("limits plans per wallet per hour", async () => {
    process.env.AWNING_PLAN_LIMIT_PER_HOUR = "2";
    const wallet = newBuyer().address;
    expect((await plan("Ridge Roast, coffee from Accra", wallet)).status).toBe(201);
    expect((await plan("Spoke and Chain, bike repair in Austin", wallet)).status).toBe(201);
    const third = await plan("Barro, ceramics studio in Lisbon", wallet);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBe("3600");
    expect((await plan("Barro, ceramics studio in Lisbon")).status).toBe(201);
  });

  it("limits free openings per wallet per day", async () => {
    process.env.AWNING_FREE_OPENS_PER_DAY = "1";
    const wallet = newBuyer().address;
    const a = await createPlan("Ridge Roast, coffee from Accra", wallet);
    const b = await createPlan("Spoke and Chain, bike repair in Austin", wallet);
    expect((await openFree(a.planId)).status).toBe(200);
    expect((await openFree(b.planId)).status).toBe(429);
  });

  it("screens offers the owner adds later", async () => {
    const p = await createPlan();
    const opened = await readJson(await openFree(p.planId));
    const res = await addOffer(
      p.business.slug,
      { title: "Online casino credits", description: "", priceUsd: 10, kind: "digital" },
      { "x-awning-plugin-key": PLUGIN_KEY, "x-awning-owner-token": opened.ownerToken },
    );
    expect(res.status).toBe(422);
    expect(await readJson(res)).toMatchObject({ error: "policy_blocked", category: "gambling" });
  });
});

describe("reports, automatic hold and operator review", () => {
  beforeEach(async () => {
    await freshWorld();
  });

  it("pauses checkout after three different reporters, hides it, and an operator can restore it", async () => {
    const p = await createPlan();
    await openFree(p.planId);
    const slug = p.business.slug;

    const first = await readJson(await report(slug, "203.0.113.1"));
    expect(first.held).toBe(false);
    // The same network reporting again does not count twice.
    expect((await readJson(await report(slug, "203.0.113.77"))).held).toBe(false);
    expect((await readJson(await report(slug, "203.0.113.1"))).held).toBe(false);
    expect((await readJson(await report(slug, "198.51.100.2"))).held).toBe(false);
    const third = await readJson(await report(slug, "192.0.2.3"));
    expect(third.held).toBe(true);

    const buyRes = await buy(slug, p.business.offers[0].sku, {});
    expect(buyRes.status).toBe(403);
    expect(buyRes.headers.get("PAYMENT-REQUIRED")).toBeNull();
    const pub = await businessGET(new Request(`${API}/v1/businesses/${slug}`), { params: Promise.resolve({ slug }) });
    expect(pub.status).toBe(410);

    const live = await readJson(await liveGET(new Request(`${API}/v1/live`)));
    expect(live.events.map((e: any) => e.type)).not.toContain("report");
    expect(live.events.map((e: any) => e.type)).not.toContain("moderation");

    process.env.AWNING_ADMIN_KEY = "test-admin-key-0123456789";
    const denied = await adminPOST(post(`/v1/admin/businesses/${slug}/status`, { action: "restore", reason: "reviewed" }, { "x-awning-admin-key": "wrong" }), {
      params: Promise.resolve({ slug }),
    });
    expect(denied.status).toBe(401);
    const restored = await adminPOST(
      post(`/v1/admin/businesses/${slug}/status`, { action: "restore", reason: "reviewed: legitimate" }, { "x-awning-admin-key": "test-admin-key-0123456789" }),
      { params: Promise.resolve({ slug }) },
    );
    expect(await readJson(restored)).toEqual({ slug, status: "live" });
    expect((await buy(slug, p.business.offers[0].sku, {})).status).toBe(402);
    delete process.env.AWNING_ADMIN_KEY;
  });

  it("reports never take down an established business on their own: a person is paged", async () => {
    const p = await createPlan();
    await openFree(p.planId);
    const slug = p.business.slug;
    const d = await db();
    await d.execute(sql`update businesses set opened_at = now() - interval '30 days', sales_count = 12 where slug = ${slug}`);
    recentAlerts.length = 0;
    for (const ip of ["203.0.113.9", "198.51.100.9", "192.0.2.9"]) expect((await readJson(await report(slug, ip))).held).toBe(false);
    expect((await buy(slug, p.business.offers[0].sku, {})).status).toBe(402);
    expect(recentAlerts[0]?.subject).toMatch(/established business/);
  });

  it("an automatic hold pages a person", async () => {
    const p = await createPlan();
    await openFree(p.planId);
    recentAlerts.length = 0;
    for (const ip of ["203.0.113.10", "198.51.100.10", "192.0.2.10"]) await report(p.business.slug, ip);
    expect(recentAlerts.map((a) => a.subject)).toContain("business held after reports: review");
    expect(recentAlerts[0]?.channels).toContain("log");
  });

  it("operator actions are off unless a key is configured", async () => {
    const p = await createPlan();
    const res = await adminPOST(post(`/v1/admin/businesses/${p.business.slug}/status`, { action: "suspend", reason: "test" }), {
      params: Promise.resolve({ slug: p.business.slug }),
    });
    expect(res.status).toBe(503);
  });

  it("rate-limits one reporter and 404s unknown businesses", async () => {
    const p = await createPlan();
    expect((await report("no-such-shop", "198.51.100.7")).status).toBe(404);
    for (let i = 0; i < 5; i++) expect((await report(p.business.slug, "198.51.100.7")).status).toBe(201);
    expect((await report(p.business.slug, "198.51.100.7")).status).toBe(429);
  });
});
