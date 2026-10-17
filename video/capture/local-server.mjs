// A local production build of web/ with every provider mocked, for footage of shops that do not
// exist on awning.sh yet. Nothing here touches web/: the committed tree (git HEAD) is exported to
// video/.cache/web, installed, built and started on its own port with an in-memory database and the
// local x402 facilitator (signatures are checked, no money moves).
//
//   node capture/local-server.mjs            build if needed, start on :3100, seed, keep running
//   node capture/local-server.mjs --rebuild  export HEAD again and rebuild
//
// Seeding goes through the public API exactly like the plugin: POST /v1/plan (+ /v1/open-free).
// Footage from this server is marked "local-mock" in public/capture/manifest.json; the film shows a
// RE-CAPTURE tag on it until it is captured again from https://awning.sh.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const video = path.resolve(here, "..");
const repo = path.resolve(video, "..");
const dir = path.join(video, ".cache", "web");
export const LOCAL_PORT = Number(process.env.LOCAL_PORT || 3100);
export const LOCAL = `http://localhost:${LOCAL_PORT}`;
const PLUGIN_KEY = "local-video-capture";
// Throwaway owner addresses for local shops (random, never a real wallet; no money moves locally).
// One per shop: the API limits free openings per wallet, as it should.
const OWNERS = { ridge: "0xab5666a7a8f9c51a3f716f22c6cfaaa4ce839541", spoke: "0xf8097c2b838e860b9f61c9651fe2729298b96604", barro: "0x95277a988d19e37e3f604b345705fb0e2ffb6fb0", efua: "0xde563c516e271bd216130c660c7c44520e2f0ecb", "ridge-draft": "0xc853ecd07142ce66e5967ddfdaa7de54064b6e71" };

const env = {
  ...process.env,
  AWNING_FORCE_MOCKS: "1",
  AWNING_DB: "memory",
  AWNING_FACILITATOR_URL: "mock",
  AWNING_API_URL: LOCAL,
  AWNING_PLUGIN_KEY: PLUGIN_KEY,
  AWNING_OWNER_TOKEN_SECRET: "local-video-capture-secret-not-for-production",
  AWNING_TREASURY_ADDRESS: "0x000000000000000000000000000000000000dEaD",
  AWNING_ENV: "local",
  NEXT_TELEMETRY_DISABLED: "1",
  PORT: String(LOCAL_PORT),
};
// never let real provider keys from the caller's shell reach the mock server
for (const k of Object.keys(env)) {
  if (/^(ANTHROPIC|OPENROUTER|AI_GATEWAY|PORKBUN|VERCEL_TOKEN|TWILIO|ELEVENLABS|DATABASE_URL|AWNING_TREASURY_PRIVATE_KEY|BUYER_PRIVATE_KEY)/.test(k)) delete env[k];
}

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });

function exportTree(force) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
  const stamp = path.join(dir, ".video-export");
  if (!force && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8").trim() === head && fs.existsSync(path.join(dir, ".next-video", "BUILD_ID"))) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.join(video, ".cache", "web.tar");
  execFileSync("git", ["archive", "--format=tar", `--output=${tar}`, "HEAD:web"], { cwd: repo });
  execFileSync("tar", ["-xf", "../web.tar"], { cwd: dir }); // relative: GNU tar reads "C:" as a host
  fs.rmSync(tar, { force: true });
  fs.writeFileSync(stamp, head + "\n");
  return true;
}

export async function startLocal({ rebuild = false } = {}) {
  if (await up()) return { url: LOCAL, proc: null };
  const fresh = exportTree(rebuild);
  if (fresh || !fs.existsSync(path.join(dir, "node_modules"))) sh("npx", ["-y", "pnpm@11.11.0", "install", "--frozen-lockfile"], { cwd: dir, env });
  const nextBin = path.join(dir, "node_modules", "next", "dist", "bin", "next");
  if (fresh || !fs.existsSync(path.join(dir, ".next-video", "BUILD_ID"))) execFileSync(process.execPath, [nextBin, "build"], { cwd: dir, env: { ...env, AWNING_NEXT_DIST: ".next-video" }, stdio: "inherit" });
  // node directly (no shell), so stopping this process stops the server
  const proc = spawn(process.execPath, [nextBin, "start", "-p", String(LOCAL_PORT)], { cwd: dir, env: { ...env, AWNING_NEXT_DIST: ".next-video" }, stdio: ["ignore", "pipe", "pipe"] });
  const stop = () => { try { proc.kill(); } catch {} };
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(130); });
  const log = fs.createWriteStream(path.join(video, ".cache", "local-server.log"));
  proc.stdout.pipe(log);
  proc.stderr.pipe(log);
  for (let i = 0; i < 120; i++) {
    if (await up()) return { url: LOCAL, proc };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("local server did not answer on " + LOCAL + " (see video/.cache/local-server.log)");
}

async function up() {
  try {
    const r = await fetch(LOCAL + "/v1/health", { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

const api = async (method, p, body, headers = {}) => {
  const r = await fetch(LOCAL + p, { method, headers: { "content-type": "application/json", "x-awning-plugin-key": PLUGIN_KEY, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${text.slice(0, 300)}`);
  return json;
};

/** The same sentences the founder types (launch/DEMO-SCRIPT.md P1), plus three neighbours for the street. */
export const SEED = [
  { key: "ridge", sentence: "Start a business: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags and a $5 tasting session. Sales go to my PayBox wallet.", open: true },
  { key: "spoke", sentence: "Open a bike repair shop in Austin called Spoke & Chain. $45 tune-ups, flats fixed while you wait for $12.", open: true },
  { key: "barro", sentence: "Start Barro Studio, a ceramics studio in Lisbon. Sell glazed bowls for $38 and a $65 Saturday wheel class.", open: true },
  { key: "efua", sentence: "Start Mama Efua's, a home kitchen in Kumasi. Sell jollof for two at $18 and a party tray for $75.", open: true },
  // a second Ridge Roast plan stays a draft: the private preview with its ribbon
  { key: "ridge-draft", sentence: "Start a business: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags and a $5 tasting session. Sales go to my PayBox wallet.", open: false },
];

export async function seed() {
  const cache = path.join(video, ".cache", "local-seed.json");
  const existing = await api("GET", "/v1/businesses").catch(() => ({ businesses: [] }));
  // the database lives in the server's memory: a running server that has shops was seeded already
  if (existing.businesses?.length && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  const out = {};
  const plans = {};
  for (const s of SEED) {
    const plan = await api("POST", "/v1/plan", { sentence: s.sentence, ownerWallet: OWNERS[s.key], country: s.key === "spoke" ? "US" : s.key === "barro" ? "PT" : "GH" });
    plans[s.key] = plan;
    if (s.open) {
      const opened = await api("POST", "/v1/open-free", { planId: plan.planId });
      out[opened.business.slug] = { ...opened.business, ownerToken: opened.ownerToken, offers: plan.business.offers };
    } else {
      out[`draft:${plan.business.slug}`] = { slug: plan.business.slug, name: plan.business.name, status: "draft", previewUrl: plan.previewUrl, offers: plan.business.offers };
    }
  }
  fs.mkdirSync(path.join(video, ".cache"), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify({ businesses: out, plans }, null, 2));
  return { businesses: out, plans };
}

/** A sale on the local server only: the local facilitator checks the signature and moves nothing. */
export async function localSale(slug, sku) {
  const url = `${LOCAL}/x402/b/${slug}/${sku}`;
  execFileSync("node", ["scripts/pay.mjs", url, JSON.stringify({ buyerNote: "Saturday morning, please" }), "--yes", "--ephemeral", "--max", "10"], { cwd: dir, env, stdio: "inherit" });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { proc } = await startLocal({ rebuild: process.argv.includes("--rebuild") });
  const seeded = await seed();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(seeded.businesses).map(([k, b]) => [k, { slug: b.slug, name: b.name, url: b.url ?? b.previewUrl }])), null, 2));
  console.log(`local mock server on ${LOCAL} (Ctrl+C to stop)`);
  if (proc) await new Promise((r) => proc.on("exit", r));
}
