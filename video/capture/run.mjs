// npm run capture [-- --only landing-hero,live] [--realtime | --both] [--force-local]
//
// Films every shot in capture/shots.mjs and writes public/capture/manifest.json, which the film
// reads: each clip's file, size and where it came from ("live" = https://awning.sh, "local-mock" =
// the local production build with mocked providers). Shots of shops come from awning.sh as soon as
// the shop exists there; until then from the local build, and the film tags them RE-CAPTURE.
// Run it again after the founder's recording session so every clip is the real, live product.
import fs from "node:fs";
import path from "node:path";
import { SHOTS } from "./shots.mjs";
import { launch, captureStepped, captureRealtime, readManifest, writeManifest, OUT, VIDEO } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt("--only")?.split(",");
const modes = flag("--both") ? ["stepped", "realtime"] : flag("--realtime") ? ["realtime"] : ["stepped"];
const LIVE = process.env.AWNING_BASE || "https://awning.sh";
const API = process.env.AWNING_API || (LIVE === "https://awning.sh" ? "https://api.awning.sh" : LIVE);

const getJson = async (u) => {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

async function answers(u) {
  try {
    const r = await fetch(u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(12000) });
    return r.ok;
  } catch {
    return false;
  }
}

const health = await getJson(`${API}/v1/health`);
if (!health?.ok) {
  console.error(`${API}/v1/health does not answer ok. Set AWNING_BASE to a reachable deployment, or try again.`);
  process.exit(1);
}
const liveShops = (await getJson(`${API}/v1/businesses?limit=50`))?.businesses ?? [];
const liveEvents = (await getJson(`${API}/v1/live`))?.events ?? [];
console.log(`awning.sh: ${liveShops.length} shops, ${liveEvents.length} events`);

let local = null;
async function useLocal() {
  if (local) return local;
  const m = await import("./local-server.mjs");
  const started = await m.startLocal();
  const seeded = await m.seed();
  local = { ...m, ...started, seeded };
  return local;
}

/** where each shot is filmed from, and its data */
async function plan(shot) {
  const forceLocal = flag("--force-local") && shot.where !== "live";
  if (shot.where === "live") return { base: LIVE, source: "live" };
  if (shot.id.startsWith("directory") && liveShops.length && !forceLocal) return { base: LIVE, source: "live" };
  if (shot.id === "live" && liveEvents.some((e) => e.type === "order") && !forceLocal) return { base: LIVE, source: "live", noSale: true };
  if (shot.where === "shop") {
    const real = !forceLocal && !shot.draft && (await getJson(`${API}/v1/businesses/${shot.shop}`))?.business;
    if (real?.url) {
      // the shop's own domain when it answers (a new domain can take a while to resolve), else its awning.sh address
      const sub = `https://${real.slug}.awning.sh`;
      const url = (await answers(real.url)) ? real.url : sub;
      return { url, source: "live", data: { ...real, ownerToken: undefined } };
    }
    if (shot.draft && process.env.DRAFT_URL && !forceLocal) return { url: process.env.DRAFT_URL, source: "live" };
    const L = await useLocal();
    const b = Object.values(L.seeded.businesses).find((x) => (shot.draft ? x.status === "draft" : x.status === "live" && /ridge/i.test(x.name ?? "")));
    if (!b) throw new Error(`no local ${shot.draft ? "draft" : "shop"} for ${shot.id}`);
    const port = new URL(L.LOCAL).port;
    // the public record of the shop (offers, payTo), exactly what an agent reads
    const full = (await getJson(`${L.LOCAL}/v1/businesses/${b.slug}`))?.business;
    return { url: `http://${b.slug}.localhost:${port}/`, source: "local-mock", data: { ...b, ...(full ?? {}), ownerToken: undefined } };
  }
  const L = await useLocal();
  return { base: L.LOCAL, source: "local-mock" };
}

const manifest = readManifest();
manifest.shots ??= {};
const browser = await launch();
try {
  for (const shot of SHOTS) {
    if (only && !only.includes(shot.id)) continue;
    const p = await plan(shot);
    const run = { ...shot, url: p.url ?? shot.url };
    console.log(`${shot.id} ← ${p.url ?? new URL(shot.path, p.base).toString()} (${p.source})`);
    let sale;
    if (shot.actions?.some((a) => a.sale) && p.source === "local-mock" && !p.noSale) {
      const L = await useLocal();
      const ridge = Object.values(L.seeded.businesses).find((x) => x.status === "live" && /ridge/i.test(x.name ?? ""));
      const offer = ridge?.offers?.find((o) => /tast/i.test(o.title)) ?? ridge?.offers?.[0];
      if (ridge && offer) sale = async () => L.localSale(ridge.slug, offer.sku);
    }
    const entry = { ...(manifest.shots[shot.id] ?? {}) };
    for (const mode of modes) {
      if (mode === "stepped") Object.assign(entry, await captureStepped(browser, run, { base: p.base, source: p.source, sale }));
      else entry.realtime = await captureRealtime(browser, run, { base: p.base, source: p.source, sale });
    }
    if (p.data) entry.data = p.data;
    entry.source = p.source;
    manifest.shots[shot.id] = entry;
    manifest.updatedAt = new Date().toISOString();
    writeManifest(manifest);
  }
  // the product's own numbers for the film's receipts: real shop and real sales when they exist
  manifest.live = { checkedAt: new Date().toISOString(), shops: liveShops.slice(0, 12), events: liveEvents.slice(0, 20) };
  if (local) {
    const loc = await getJson(`${local.LOCAL}/v1/live`);
    manifest.local = { shops: Object.values(local.seeded.businesses).map(({ ownerToken, ...b }) => b), events: loc?.events ?? [] };
  }
  writeManifest(manifest);
} finally {
  await browser.close();
  if (local?.proc) local.proc.kill();
}
console.log(`manifest → ${path.relative(VIDEO, path.join(OUT, "manifest.json"))}`);
process.exit(0);
