// Test-only preload (node --import): replaces global fetch with an in-memory Awning API
// so the real bundle can be exercised over stdio without network access.
// AWNING_MOCK selects a scenario; AWNING_MOCK_LOG receives one JSON line per request.
import { appendFileSync } from "node:fs";

const scenario = process.env.AWNING_MOCK ?? "ok";
const log = process.env.AWNING_MOCK_LOG;
const OWNER = "0x1111111111111111111111111111111111111111";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const now = Date.now();

const plan = (id) => ({
  planId: id,
  expiresAt: new Date(now + (id === "plan_soon" ? 120_000 : id === "plan_gone" ? 20_000 : 1_800_000)).toISOString(),
  previewUrl: "https://ridge-roast.awning.sh",
  business: {
    slug: "ridge-roast", name: "Ridge Roast", tagline: "Small-batch coffee from Accra",
    description: "Roasted weekly in Osu.", category: "food", city: "Accra", status: "draft",
    palette: { primary: "#3b2416", accent: "#e0a458", ink: "#1b1b1b", paper: "#fbf7f1" },
    offers: [{ sku: "tasting", title: "Tasting session", description: "45 minutes, 4 coffees", priceUsd: 5, kind: "booking" }],
    extraField: "ignored",
  },
  domains: [
    { domain: "ridgeroast.co", available: true, priceUsd: 11.98 },
    { domain: "ridgeroast.com", available: false, priceUsd: 14.99 },
  ],
  packages: [
    { id: "free", label: "Free", includes: ["ridge-roast.awning.sh"], priceUsd: 0 },
    { id: "pro", label: "Pro", includes: ["Custom domain", "Phone line", "AI receptionist"], priceUsd: 9 },
  ],
});

const business = {
  slug: "ridge-roast", name: "Ridge Roast", tagline: "Small-batch coffee from Accra", description: "Roasted weekly in Osu.",
  category: "food", city: "Accra", url: "https://ridgeroast.co", phone: "+233200000000", domain: "ridgeroast.co",
  status: "live", openedAt: "2026-10-17T10:00:00Z", salesCount: 3,
  offers: [
    { sku: "tasting", title: "Tasting session", description: "45 minutes, 4 coffees", priceUsd: 19.99, kind: "booking" },
    { sku: "bag-250g", title: "250 g bag", description: null, priceUsd: "12.5", kind: "product" },
  ],
};

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function challenge(amount, payTo) {
  const required = {
    x402Version: 2,
    error: "Payment required",
    resource: { url: "https://api.awning.sh/x402", mimeType: "application/json" },
    accepts: [{ scheme: "exact", network: "eip155:8453", amount, asset: USDC, payTo, maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" } }],
  };
  return json(402, {}, { "payment-required": Buffer.from(JSON.stringify(required)).toString("base64") });
}

function route(method, url, body, headers) {
  const path = url.pathname;
  if (scenario === "down") return json(503, { error: "upstream exploded", debug: "x-awning-plugin-key=SECRET-SHOULD-NOT-LEAK" });
  if (method === "POST" && path === "/v1/plan") return json(200, plan("plan_new"));
  let m;
  if (method === "GET" && (m = path.match(/^\/v1\/plans\/([^/]+)$/))) {
    return m[1] === "missing" ? json(404, { error: "not found" }) : json(200, plan(decodeURIComponent(m[1])));
  }
  if (method === "POST" && (m = path.match(/^\/x402\/open\/([^/]+)$/))) {
    return challenge(scenario === "quote-mismatch" ? "21980000" : "20980000", "0x2222222222222222222222222222222222222222");
  }
  if (method === "POST" && path === "/v1/open-free") {
    return json(200, { business: { slug: "ridge-roast", name: "Ridge Roast", url: "https://ridge-roast.awning.sh", status: "live" }, ownerToken: "own_test_token_123" });
  }
  if (method === "GET" && path === "/v1/businesses") return json(200, { businesses: [business] });
  if (method === "GET" && path === "/v1/businesses/ridge-roast") return json(200, business);
  if (method === "GET" && path.startsWith("/v1/businesses/")) return json(404, { error: "no such business" });
  if (method === "POST" && (m = path.match(/^\/x402\/b\/([^/]+)\/([^/]+)$/))) {
    const offer = business.offers.find((o) => o.sku === decodeURIComponent(m[2]));
    if (!offer) return json(404, { error: "no such offer" });
    const unit = BigInt(Math.round(Number(offer.priceUsd) * 100)) * 10_000n;
    const qty = BigInt(body?.qty ?? 1);
    const amount = scenario === "quote-mismatch" ? unit * qty + 1n : unit * qty;
    return challenge(amount.toString(), OWNER);
  }
  if (method === "POST" && path === "/v1/businesses/ridge-roast/offers") {
    if (headers["x-awning-owner-token"] !== "own_test_token_123") return json(401, { error: "bad owner token" });
    const added = { sku: "sub-box", title: body.title, description: body.description, priceUsd: body.priceUsd, kind: body.kind };
    return json(201, { offer: added, offers: [...business.offers, added] });
  }
  if (method === "GET" && path === "/v1/orders") {
    if (headers["x-awning-owner-token"] !== "own_test_token_123") return json(401, { error: "bad owner token" });
    return json(200, { orders: [
      { id: "ord_1", sku: "tasting", qty: 2, totalUsd: 39.98, status: "paid", createdAt: "2026-10-17T11:00:00Z", tx: "0xabc", payer: OWNER },
      { id: 2, sku: "bag-250g", qty: 1, totalUsd: "12.50", status: "paid", at: "2026-10-17T12:00:00Z" },
    ] });
  }
  return json(404, { error: "unknown route" });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = init.method ?? "GET";
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  if (log) {
    appendFileSync(log, `${JSON.stringify({ method, url: url.toString(), headers, body,
      redirect: init.redirect ?? null, hasSignal: init.signal instanceof AbortSignal })}\n`);
  }
  if (scenario === "slow") {
    return new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  }
  return route(method, url, body, headers);
};
