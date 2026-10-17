// Awning plugin unit checks. Run after a build: `node scripts/unit.mjs`.
// 1) Pure helpers from src/awning.ts (loaded with tsx): USDC math, expiry, quotes, proposals.
// 2) The built dist/plugin.mjs over MCP stdio, one fresh process per call (like the PayBox sandbox),
//    with fetch replaced by scripts/fixtures/mock-fetch.mjs so no network is used.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

import { compileSchema } from "./schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "dist/plugin.mjs");
const mock = pathToFileURL(join(root, "scripts/fixtures/mock-fetch.mjs")).href;
const KEY = "io.paybox/transactionProposal";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const results = [];

async function test(name, run) {
  const started = performance.now();
  try {
    await run();
    results.push({ name, ok: true, ms: Math.round(performance.now() - started) });
  } catch (error) {
    results.push({ name, ok: false, error: error?.message ?? String(error) });
  }
}

// ---------------------------------------------------------------- MCP stdio client

let id = 1;
function rpc(method, params, { scenario = "ok", env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "awning-unit-"));
  const log = join(dir, "requests.jsonl");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--import", mock, bundle], {
      cwd: dirname(bundle),
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "production", AWNING_MOCK: scenario, AWNING_MOCK_LOG: log, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const requestId = id++;
    let buffer = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${method} exceeded 10 s`)); }, 10_000);
    const finish = (value, error) => {
      clearTimeout(timer);
      child.kill();
      const requests = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
      rmSync(dir, { recursive: true, force: true });
      if (error) reject(error); else resolvePromise({ ...value, requests });
    };
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const message = JSON.parse(line);
        if (message.id !== requestId) continue;
        if (message.error) return finish(null, new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`));
        return finish({ result: message.result, stderr });
      }
    });
    child.on("error", (error) => finish(null, error));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params: { ...params, _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "awning-unit", version: "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } } })}\n`);
  });
}

let catalog;
async function tools() {
  catalog ??= (await rpc("tools/list", {})).result.tools;
  return catalog;
}

async function call(name, args, options) {
  const response = await rpc("tools/call", { name, arguments: args }, options);
  const tool = (await tools()).find((t) => t.name === name);
  if (!response.result.isError) {
    const validate = compileSchema(tool.outputSchema);
    assert.ok(validate(response.result.structuredContent), `${name} structuredContent must match its outputSchema: ${JSON.stringify(validate.errors)}`);
  }
  return response;
}

function text(result) {
  return result.content.map((c) => c.text).join("\n");
}

function checkProposal(structured, { path, body, maxAmount }) {
  const p = structured[KEY];
  assert.equal(p.version, "1");
  assert.equal(p.kind, "x402");
  assert.equal(p.chain, "eip155:8453");
  const url = new URL(p.request.url);
  assert.equal(url.protocol, "https:");
  assert.equal(url.host, "api.awning.sh");
  assert.equal(url.pathname, path);
  assert.equal(p.request.method, "POST");
  assert.deepEqual(p.request.body, body);
  assert.ok(Buffer.byteLength(JSON.stringify(p.request.body)) <= 64 * 1024, "body must be at most 64 KiB");
  assert.equal(p.payment.asset, USDC);
  assert.equal(p.payment.maxAmount, maxAmount);
  assert.match(p.expiresAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const ms = Date.parse(p.expiresAt) - Date.now();
  assert.ok(ms > 0 && ms <= 300_000, `expiry must be within five minutes (got ${ms} ms)`);
  return p;
}

// ---------------------------------------------------------------- pure helpers

const h = await tsImport("../src/awning.ts", import.meta.url);

await test("usdToAtomic converts decimals exactly, without floats", () => {
  assert.equal(h.usdToAtomic("19.99"), "19990000");
  assert.equal(h.usdToAtomic(19.99), "19990000");
  assert.equal(h.usdToAtomic(11.98), "11980000");
  assert.equal(h.usdToAtomic("0.000001"), "1");
  assert.equal(h.usdToAtomic("5"), "5000000");
  assert.equal(h.usdToAtomic("12.500000000"), "12500000");
  assert.throws(() => h.usdToAtomic(0.1 + 0.2), /6 decimal/);
  assert.throws(() => h.usdToAtomic("1e3"));
  assert.throws(() => h.usdToAtomic(-1));
  assert.throws(() => h.usdToAtomic(1e21));
});

await test("formatUsdc and totalAtomic: price x qty in atomic units", () => {
  assert.equal(h.formatUsdc("19000000"), "19.00");
  assert.equal(h.formatUsdc("1234500"), "1.2345");
  assert.equal(h.formatUsdc("1"), "0.000001");
  assert.equal(h.totalAtomic(h.usdToAtomic(19.99), 3), "59970000");
  assert.equal(h.totalAtomic(h.usdToAtomic("0.1"), 3), "300000");
  assert.equal(h.totalAtomic("999999999999", 100), "99999999999900");
  assert.throws(() => h.totalAtomic("1000000", 0));
  assert.throws(() => h.totalAtomic("1000000", 1.5));
});

await test("proposalExpiry is whole-second, at most 4 minutes, and never later than the quote", () => {
  const now = Date.parse("2026-10-17T12:00:00.500Z");
  assert.equal(h.proposalExpiry(undefined, now), "2026-10-17T12:04:00Z");
  assert.equal(h.proposalExpiry("2026-10-17T12:02:30.900Z", now), "2026-10-17T12:02:30Z");
  assert.equal(h.proposalExpiry("2026-10-17T13:00:00Z", now), "2026-10-17T12:04:00Z");
  assert.throws(() => h.proposalExpiry("2026-10-17T12:00:40Z", now), /less than a minute/);
  assert.throws(() => h.proposalExpiry("not a date", now));
});

await test("readQuote reads x402 v2 and v1 challenges, only for USDC on Base", () => {
  const v2 = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "5000000", asset: USDC.toUpperCase().replace("0X", "0x"), payTo: "0xabc" }] };
  const header = new Headers({ "payment-required": Buffer.from(JSON.stringify(v2)).toString("base64") });
  assert.deepEqual(h.readQuote({ status: 402, headers: header, data: {} }), { state: "verified", amount: "5000000", payTo: "0xabc" });
  const v1 = { x402Version: 1, accepts: [{ scheme: "exact", network: "base", maxAmountRequired: "7", asset: USDC, payTo: "0xdef" }] };
  assert.deepEqual(h.readQuote({ status: 402, headers: new Headers(), data: v1 }), { state: "verified", amount: "7", payTo: "0xdef" });
  const solana = { accepts: [{ scheme: "exact", network: "solana:mainnet", amount: "7", asset: "EPj", payTo: "x" }] };
  assert.deepEqual(h.readQuote({ status: 402, headers: new Headers(), data: solana }), { state: "incompatible" });
  assert.deepEqual(h.readQuote({ status: 500, headers: new Headers(), data: null }), { state: "unverified" });
});

await test("proposal builders: host api.awning.sh, POST, exact body, USDC on Base", () => {
  const now = Date.now();
  const expiresAt = h.proposalExpiry();
  const open = h.proposeOpen({ planId: "plan_1", domain: "ridgeroast.co", maxAmount: "20980000", expiresAt }).structuredContent;
  checkProposal(open, { path: "/x402/open/plan_1", body: { domain: "ridgeroast.co", package: "pro" }, maxAmount: "20980000" });
  const body = h.buyBody({ qty: 2, buyerNote: "Saturday 10am" });
  assert.deepEqual(body, { qty: 2, buyerNote: "Saturday 10am" });
  const buy = h.proposeBuy({ slug: "ridge-roast", sku: "tasting", body, maxAmount: "39980000", expiresAt }).structuredContent;
  checkProposal(buy, { path: "/x402/b/ridge-roast/tasting", body, maxAmount: "39980000" });
  assert.ok(Date.parse(expiresAt) - now <= 240_000);
  assert.throws(() => h.proposeBuy({ slug: "a", sku: "b", body: { qty: 1, buyerNote: "x".repeat(70_000) }, maxAmount: "1", expiresAt }), /64 KiB/);
});

await test("apiBase defaults to https://api.awning.sh and rejects unsafe overrides", () => {
  assert.equal(h.apiBase(undefined), "https://api.awning.sh");
  assert.equal(h.apiBase("https://api.awning.sh/"), "https://api.awning.sh");
  assert.equal(h.apiBase("http://localhost:3000"), "http://localhost:3000");
  assert.throws(() => h.apiBase("http://evil.example"));
  assert.throws(() => h.apiBase("https://user:pw@api.awning.sh"));
});

// ---------------------------------------------------------------- built bundle over stdio

await test("tools/list: nine tools, strict inputs, output schemas, honest annotations", async () => {
  const list = await tools();
  assert.deepEqual(list.map((t) => t.name).sort(), ["awning_about", "awning_add_offer", "awning_business", "awning_buy",
    "awning_find", "awning_open", "awning_open_free", "awning_orders", "awning_plan"]);
  for (const t of list) {
    assert.ok(t.title && t.description.length > 80, `${t.name} needs a title and an agent-facing description`);
    assert.equal(t.inputSchema.additionalProperties, false, `${t.name} input must be strict`);
    assert.equal(t.outputSchema.additionalProperties, false, `${t.name} output must be strict`);
    assert.equal(t.annotations.destructiveHint, false);
  }
  const readOnly = list.filter((t) => t.annotations.readOnlyHint).map((t) => t.name).sort();
  assert.deepEqual(readOnly, ["awning_about", "awning_business", "awning_find", "awning_orders"]);
  for (const name of ["awning_open", "awning_buy"]) {
    const t = list.find((x) => x.name === name);
    assert.ok(t.outputSchema.properties[KEY], `${name} declares ${KEY}`);
    assert.equal(t.annotations.idempotentHint, false);
  }
  assert.equal(list.find((t) => t.name === "awning_about").annotations.openWorldHint, false);
});

await test("awning_about is static: no network requests", async () => {
  const { result, requests } = await call("awning_about", {});
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.apiHost, "api.awning.sh");
  assert.equal(requests.length, 0);
});

await test("awning_buy: maxAmount = price x qty, verified against the live 402", async () => {
  const { result, requests } = await call("awning_buy", { slug: "ridge-roast", sku: "tasting", qty: 3, buyerNote: "Saturday 10am" });
  assert.ok(!result.isError, text(result));
  checkProposal(result.structuredContent, { path: "/x402/b/ridge-roast/tasting", body: { qty: 3, buyerNote: "Saturday 10am" }, maxAmount: "59970000" });
  assert.match(text(result), /59\.97 USDC/);
  assert.match(text(result), /Poll the returned PayBox request/);
  assert.match(text(result), /0x1111111111111111111111111111111111111111/);
  for (const r of requests) {
    assert.equal(r.redirect, "error");
    assert.equal(r.hasSignal, true);
    assert.ok(!("x-awning-plugin-key" in r.headers), "the plugin never sends the brokered key itself");
    assert.equal(new URL(r.url).host, "api.awning.sh");
  }
  const quote = requests.find((r) => r.url.includes("/x402/"));
  assert.deepEqual(quote.body, { qty: 3, buyerNote: "Saturday 10am" }, "quote request body equals the proposal body");
});

await test("awning_buy: decimal-string price and default qty", async () => {
  const { result } = await call("awning_buy", { slug: "ridge-roast", sku: "bag-250g" });
  assert.ok(!result.isError, text(result));
  checkProposal(result.structuredContent, { path: "/x402/b/ridge-roast/bag-250g", body: { qty: 1 }, maxAmount: "12500000" });
});

await test("awning_buy refuses when the live checkout disagrees with the listed price", async () => {
  const { result } = await call("awning_buy", { slug: "ridge-roast", sku: "tasting", qty: 1 }, { scenario: "quote-mismatch" });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined, "no proposal inside an error");
  assert.match(text(result), /price changed/i);
});

await test("awning_buy: unknown sku and unknown business give actionable errors", async () => {
  const sku = await call("awning_buy", { slug: "ridge-roast", sku: "nope" });
  assert.equal(sku.result.isError, true);
  assert.match(text(sku.result), /tasting/);
  const biz = await call("awning_buy", { slug: "nobody", sku: "x" });
  assert.equal(biz.result.isError, true);
  assert.match(text(biz.result), /awning_find/);
});

await test("awning_open: confirms the quoted price and proposes exactly it", async () => {
  const { result } = await call("awning_open", { planId: "plan_ok", domain: "ridgeroast.co", priceUsd: "20.98" });
  assert.ok(!result.isError, text(result));
  checkProposal(result.structuredContent, { path: "/x402/open/plan_ok", body: { domain: "ridgeroast.co", package: "pro" }, maxAmount: "20980000" });
  assert.match(text(result), /approve 20\.98 USDC/);
  assert.match(text(result), /do not call awning_open again/);
});

await test("awning_open refuses a price that differs from the quote and names the right one", async () => {
  const wrong = await call("awning_open", { planId: "plan_ok", domain: "ridgeroast.co", priceUsd: 20.99 });
  assert.equal(wrong.result.isError, true);
  assert.match(text(wrong.result), /20\.98/);
  const moved = await call("awning_open", { planId: "plan_ok", domain: "ridgeroast.co", priceUsd: "20.98" }, { scenario: "quote-mismatch" });
  assert.equal(moved.result.isError, true);
  assert.match(text(moved.result), /21\.98/);
});

await test("awning_open: unavailable or unlisted domain, missing plan, expiring plan", async () => {
  const taken = await call("awning_open", { planId: "plan_ok", domain: "ridgeroast.com", priceUsd: "23.99" });
  assert.equal(taken.result.isError, true);
  assert.match(text(taken.result), /no longer available/);
  const other = await call("awning_open", { planId: "plan_ok", domain: "example.org", priceUsd: "1" });
  assert.match(text(other.result), /ridgeroast\.co/);
  const missing = await call("awning_open", { planId: "missing", domain: "ridgeroast.co", priceUsd: "20.98" });
  assert.match(text(missing.result), /awning_plan/);
  const gone = await call("awning_open", { planId: "plan_gone", domain: "ridgeroast.co", priceUsd: "20.98" });
  assert.match(text(gone.result), /less than a minute/);
});

await test("awning_open: proposal never outlives a plan that expires sooner than four minutes", async () => {
  const { result } = await call("awning_open", { planId: "plan_soon", domain: "ridgeroast.co", priceUsd: "20.98" });
  assert.ok(!result.isError, text(result));
  const ms = Date.parse(result.structuredContent[KEY].expiresAt) - Date.now();
  assert.ok(ms <= 120_000 && ms > 60_000, `expected about two minutes, got ${ms} ms`);
});

await test("awning_plan maps domains to exact open prices", async () => {
  const { result } = await call("awning_plan", { sentence: "Small-batch coffee from Accra with tasting sessions", ownerWallet: "0x1111111111111111111111111111111111111111" });
  assert.ok(!result.isError, text(result));
  const s = result.structuredContent;
  assert.deepEqual(s.domains, [
    { domain: "ridgeroast.co", available: true, domainPriceUsd: "11.98", openPriceUsd: "20.98" },
    { domain: "ridgeroast.com", available: false, domainPriceUsd: "14.99", openPriceUsd: null },
  ]);
  assert.equal(s.business.offers[0].priceAtomicUsdc, "5000000");
});

await test("awning_find, awning_business, awning_open_free return schema-valid data", async () => {
  const find = await call("awning_find", { query: "coffee" });
  assert.equal(find.result.structuredContent.count, 1);
  assert.equal(new URL(find.requests[0].url).searchParams.get("q"), "coffee");
  const one = await call("awning_business", { slug: "ridge-roast" });
  assert.equal(one.result.structuredContent.business.offers[1].priceUsd, "12.50");
  const free = await call("awning_open_free", { planId: "plan_ok" });
  assert.equal(free.result.structuredContent.business.status, "live");
});

await test("owner tools send the owner token as a header and never echo it", async () => {
  const add = await call("awning_add_offer", { slug: "ridge-roast", ownerToken: "own_test_token_123", title: "Monthly box", description: "Two bags a month.", priceUsd: "30", kind: "subscription" });
  assert.ok(!add.result.isError, text(add.result));
  assert.equal(add.requests[0].headers["x-awning-owner-token"], "own_test_token_123");
  assert.deepEqual(add.requests[0].body, { title: "Monthly box", description: "Two bags a month.", priceUsd: 30, kind: "subscription" });
  assert.equal(add.result.structuredContent.added.sku, "sub-box");
  assert.ok(!JSON.stringify(add.result).includes("own_test_token_123"));
  const orders = await call("awning_orders", { slug: "ridge-roast", ownerToken: "own_test_token_123" });
  assert.equal(orders.result.structuredContent.totalUsd, "52.48");
  assert.ok(!JSON.stringify(orders.result).includes("own_test_token_123"));
  const bad = await call("awning_orders", { slug: "ridge-roast", ownerToken: "wrong_token_000" });
  assert.equal(bad.result.isError, true);
  assert.match(text(bad.result), /owner token/);
});

await test("upstream failure: isError, short message, nothing leaked", async () => {
  const { result } = await call("awning_find", {}, { scenario: "down" });
  assert.equal(result.isError, true);
  assert.match(text(result), /temporarily unavailable \(HTTP 503\)/);
  assert.ok(!text(result).includes("SECRET"));
});

await test("timeout: a silent API fails within the 4 s budget", async () => {
  const started = Date.now();
  const { result } = await call("awning_business", { slug: "ridge-roast" }, { scenario: "slow" });
  const elapsed = Date.now() - started;
  assert.equal(result.isError, true);
  assert.match(text(result), /within 4 seconds/);
  assert.ok(elapsed < 7_000, `took ${elapsed} ms`);
});

await test("invalid input is rejected by the strict schema", async () => {
  const extra = await rpc("tools/call", { name: "awning_buy", arguments: { slug: "ridge-roast", sku: "tasting", qty: 0 } });
  assert.equal(extra.result.isError, true);
  const unknown = await rpc("tools/call", { name: "awning_find", arguments: { surprise: true } });
  assert.equal(unknown.result.isError, true);
});

const failed = results.filter((r) => !r.ok);
process.stdout.write(`${JSON.stringify({ status: failed.length ? "failed" : "passed", passed: results.length - failed.length, failed: failed.length, results }, null, 2)}\n`);
process.exitCode = failed.length ? 1 : 0;
