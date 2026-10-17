// Playwright capture harness for the film's product footage.
//
// A shot is a page plus a timeline: scroll keyframes, cursor keyframes and actions (click, type,
// a local sale). Two ways to film it:
//   stepped  (default) virtual time (vt.js): one screenshot per 1/30 s at deviceScaleFactor 2,
//            piped into x264 → public/capture/<id>.mp4 (3072×1728 for a 1536×864 viewport), plus
//            DSF 2 stills. Every page animation plays at its real speed and the motion is exact.
//   realtime Playwright recordVideo at 1920×1080 (25 fps, VP9) → public/capture/rt/<id>.webm,
//            the same timeline played against the wall clock.
// The film uses the stepped files and falls back to the realtime ones.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO = path.resolve(here, "..");
export const OUT = path.join(VIDEO, "public", "capture");
const VT = fs.readFileSync(path.join(here, "vt.js"), "utf8");
export const FPS = 30;

export function ffmpegPath() {
  const require = createRequire(import.meta.url);
  const renderer = path.dirname(require.resolve("@remotion/renderer/package.json"));
  const r2 = createRequire(path.join(renderer, "package.json"));
  const pkg = { win32: "@remotion/compositor-win32-x64-msvc", darwin: process.arch === "arm64" ? "@remotion/compositor-darwin-arm64" : "@remotion/compositor-darwin-x64", linux: "@remotion/compositor-linux-x64-gnu" }[process.platform];
  const dir = path.dirname(r2.resolve(`${pkg}/package.json`));
  return path.join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

/** Playwright's own Chromium when installed, else the newest Chromium already in ms-playwright. */
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    if (fs.existsSync(chromium.executablePath())) return undefined;
  } catch {}
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || "", ".cache"), "ms-playwright");
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of dirs) {
    for (const exe of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const p = path.join(root, d, exe);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

export async function launch() {
  return chromium.launch({
    executablePath: chromiumPath(),
    args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=TranslateUI", "--no-first-run", "--mute-audio"],
  });
}

// ---------- timeline sampling ----------
const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // a long, soft glide (quint), for scrolls that should feel like a camera move
  glide: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
};
/** keys: [[t, ...values, ease?]] → values at time t (each segment eases into its end key) */
export function sample(keys, t) {
  if (!keys?.length) return null;
  const num = (k) => k.slice(1).filter((x) => typeof x === "number");
  if (t <= keys[0][0]) return num(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const [t1] = keys[i];
    if (t <= t1) {
      const a = num(keys[i - 1]);
      const b = num(keys[i]);
      const ease = EASE[keys[i].find((x) => typeof x === "string") ?? "inOut"] ?? EASE.inOut;
      const p = ease((t - keys[i - 1][0]) / Math.max(1e-6, t1 - keys[i - 1][0]));
      return a.map((v, j) => v + (b[j] - v) * p);
    }
  }
  return num(keys[keys.length - 1]);
}

async function resolveScroll(page, keys) {
  if (!keys) return null;
  const out = [];
  for (const k of keys) {
    const [t, y, ...rest] = k;
    if (typeof y === "number") out.push(k);
    else {
      const top = await page.evaluate(({ sel, offset, align }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const max = document.documentElement.scrollHeight - innerHeight;
        const at = align === "bottom" ? r.bottom - innerHeight : align === "center" ? r.top + r.height / 2 - innerHeight / 2 : r.top;
        return Math.max(0, Math.min(max, at + scrollY + (offset || 0)));
      }, y);
      if (top == null) throw new Error(`scroll anchor not found: ${y.sel}`);
      out.push([t, top, ...rest]);
    }
  }
  return out;
}

async function prepare(page, shot, url) {
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    document.documentElement.style.scrollBehavior = "auto";
  });
  if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 20000 });
  if (shot.setup) await shot.setup(page);
  if (!shot.startFrozen) await page.waitForTimeout(shot.settle ?? 1800);
}

/** cursor keys may name a point from shot.points(page): [t, "book", ease] */
async function resolvePoints(page, shot) {
  const points = shot.points ? await shot.points(page) : {};
  const cursor = shot.cursor?.map((k) => {
    if (typeof k[1] !== "string") return k;
    const p = points[k[1]];
    if (!p) throw new Error(`cursor point not found: ${k[1]}`);
    return [k[0], p.x, p.y, ...k.slice(2)];
  });
  return { points, cursor };
}

function due(actions, t0, t1) {
  return (actions || []).filter((a) => a.at >= t0 && a.at < t1);
}

async function runAction(page, a, ctx) {
  if (a.click) {
    await page.evaluate(({ sel, keep }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (!keep) {
        // the page's own handlers run; the browser's jump to an anchor or navigation does not
        const stop = (e) => { e.preventDefault(); document.removeEventListener("click", stop, true); };
        document.addEventListener("click", stop, true);
      }
      el.click();
    }, { sel: a.click, keep: !!a.navigate });
  }
  if (a.clickPoint) {
    const p = ctx.points?.[a.clickPoint];
    if (p) {
      await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y)?.closest("a,button,[data-sku]") ?? document.elementFromPoint(x, y);
        if (!el) return;
        const stop = (e) => { e.preventDefault(); document.removeEventListener("click", stop, true); };
        document.addEventListener("click", stop, true);
        el.click();
      }, p);
    }
  }
  if (a.sale && ctx.sale) await ctx.sale();
  if (a.focus) await page.focus(a.focus);
  if (a.key) await page.keyboard.press(a.key);
  if (a.text != null) await page.keyboard.insertText(a.text);
  if (a.run) await a.run(page, ctx);
}

/** expand {type:{selector,text,cps,at}} into one insertText per character */
function expandActions(actions = []) {
  const out = [];
  for (const a of actions) {
    if (a.type) {
      const { text, cps = 11 } = a.type;
      out.push({ at: a.at, focus: a.type.selector });
      [...text].forEach((ch, i) => out.push({ at: a.at + 0.12 + i / cps, text: ch }));
    } else out.push(a);
  }
  return out.sort((x, y) => x.at - y.at);
}

// ---------- stepped (virtual time, frame-exact) ----------
export async function captureStepped(browser, shot, { base, source, dsf = 2, quality = 92, log = console.log, ...ctxIn } = {}) {
  const viewport = shot.viewport ?? { width: 1536, height: 864 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, reducedMotion: "no-preference", colorScheme: "light", locale: "en-US", timezoneId: "UTC" });
  await context.addInitScript({ content: `window.__VT_CFG=${JSON.stringify({ frozen: !!shot.startFrozen })};\n${VT}` });
  const page = await context.newPage();
  const url = shot.url ?? new URL(shot.path, base).toString();
  await prepare(page, shot, url);
  const scroll = await resolveScroll(page, shot.scroll);
  const { points, cursor } = await resolvePoints(page, shot);
  const actx = { ...ctxIn, points };
  const actions = expandActions(shot.actions);
  fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });
  const file = path.join(OUT, `${shot.id}.mp4`);
  const tmp = file + ".part.mp4";
  const ff = spawn(ffmpegPath(), ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-g", "15", "-bf", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((res, rej) => ff.on("exit", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exit " + c)))));
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));

  const frames = Math.round(shot.duration * FPS);
  const stills = new Map((shot.stills || []).map((s) => [Math.round(s.at * FPS), s.name]));
  let lastMouse = null;
  let pressed = false;
  const started = Date.now();
  await page.evaluate(() => window.__vt.manual());
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    for (const a of due(actions, t - 1 / FPS + 1e-9, t + 1e-9)) {
      if (a.press != null) pressed = a.press;
      await runAction(page, a, actx);
    }
    const c = sample(cursor, t);
    if (c && (!lastMouse || c[0] !== lastMouse[0] || c[1] !== lastMouse[1])) {
      await page.mouse.move(c[0], c[1]);
      lastMouse = c;
    }
    const y = scroll ? sample(scroll, t)[0] : null;
    await page.evaluate(
      ({ y, c, pressed, dt }) => {
        if (y != null) window.scrollTo(0, Math.round(y * 2) / 2);
        window.__vt.step(dt);
        if (c) window.__vt.cursor(c[0], c[1], pressed, true);
        else window.__vt.cursor(-100, -100, false, false);
      },
      { y, c, pressed, dt: f === 0 ? 0 : 1000 / FPS },
    );
    const jpg = await page.screenshot({ type: "jpeg", quality, animations: "allow", caret: "initial", scale: "device" });
    await write(jpg);
    if (stills.has(f)) await page.screenshot({ path: path.join(OUT, "stills", `${stills.get(f)}.png`), type: "png", scale: "device" });
    if (f % 60 === 0) log(`  ${shot.id}: frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await ffDone;
  fs.renameSync(tmp, file);
  const meta = await page.evaluate(() => ({ title: document.title, url: location.href, height: document.documentElement.scrollHeight }));
  await context.close();
  log(`  ${shot.id}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s → ${path.relative(VIDEO, file)}`);
  return { id: shot.id, file: `capture/${shot.id}.mp4`, width: viewport.width * dsf, height: viewport.height * dsf, fps: FPS, frames, durationSec: shot.duration, url: meta.url, title: meta.title, source, displayUrl: shot.displayUrl ?? prettyUrl(meta.url, source), capturedAt: new Date().toISOString(), viewport, dsf, mode: "stepped" };
}

// ---------- a still (third-party pages: a plain page load, no virtual clock, one DSF 2 screenshot) ----------
export async function captureStill(browser, shot, { base, source, dsf = 2, log = console.log } = {}) {
  const viewport = shot.viewport ?? { width: 1536, height: 864 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, colorScheme: "light", locale: "en-US", timezoneId: "UTC", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });
  const page = await context.newPage();
  const url = shot.url ?? new URL(shot.path, base).toString();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(shot.settle ?? 4000);
  if (shot.setup) await shot.setup(page);
  await page.waitForTimeout(800);
  fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });
  const file = path.join(OUT, "stills", `${shot.id}.png`);
  await page.screenshot({ path: file, type: "png", scale: "device" });
  const title = await page.title();
  await context.close();
  log(`  ${shot.id}: still → ${path.relative(VIDEO, file)} (${title})`);
  return { id: shot.id, still: `capture/stills/${shot.id}.png`, file: `capture/stills/${shot.id}.png`, width: viewport.width * dsf, height: viewport.height * dsf, url, title, source, displayUrl: shot.displayUrl ?? prettyUrl(url, source), capturedAt: new Date().toISOString(), viewport, dsf, mode: "still" };
}

// ---------- realtime (Playwright recordVideo) ----------
export async function captureRealtime(browser, shot, { base, source, log = console.log, ...ctxIn } = {}) {
  const viewport = shot.viewport ?? { width: 1536, height: 864 };
  const size = { width: 1920, height: 1080 };
  const dir = path.join(OUT, "rt", ".tmp-" + shot.id);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: size.width / viewport.width, reducedMotion: "no-preference", colorScheme: "light", locale: "en-US", timezoneId: "UTC", recordVideo: { dir, size } });
  await context.addInitScript({ content: `window.__VT_CFG=${JSON.stringify({ frozen: false })};\n${VT}` });
  const page = await context.newPage();
  const url = shot.url ?? new URL(shot.path, base).toString();
  await prepare(page, shot, url);
  const scroll = await resolveScroll(page, shot.scroll);
  const { points, cursor } = await resolvePoints(page, shot);
  const actx = { ...ctxIn, points };
  const actions = expandActions(shot.actions);
  const t0 = Date.now();
  let i = 0;
  let pressed = false;
  for (;;) {
    const t = (Date.now() - t0) / 1000;
    if (t > shot.duration) break;
    while (i < actions.length && actions[i].at <= t) {
      if (actions[i].press != null) pressed = actions[i].press;
      await runAction(page, actions[i++], actx);
    }
    const c = sample(cursor, t);
    if (c) await page.mouse.move(c[0], c[1]);
    const y = scroll ? sample(scroll, t)[0] : null;
    await page.evaluate(({ y, c, pressed }) => {
      if (y != null) window.scrollTo(0, y);
      if (c) window.__vt.cursor(c[0], c[1], pressed, true);
      else window.__vt.cursor(-100, -100, false, false);
    }, { y, c, pressed });
    await page.waitForTimeout(12);
  }
  const video = page.video();
  await context.close();
  const out = path.join(OUT, "rt", `${shot.id}.webm`);
  await video.saveAs(out);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`  ${shot.id}: realtime ${shot.duration}s → ${path.relative(VIDEO, out)}`);
  return { file: `capture/rt/${shot.id}.webm`, width: size.width, height: size.height, fps: 25, mode: "realtime" };
}

export function prettyUrl(u, source) {
  try {
    const url = new URL(u);
    let host = url.host;
    if (source === "local-mock") {
      // local footage stands in for the real shop; the film tags it RE-CAPTURE
      host = host.replace(/:\d+$/, "").replace(/\.localhost$/, ".awning.sh").replace(/^localhost$/, "awning.sh");
    }
    const p = url.pathname === "/" ? "" : url.pathname;
    const q = url.search.replace(/^\?b=.*/, "");
    return host + p + q;
  } catch {
    return u;
  }
}

export function readManifest() {
  const f = path.join(OUT, "manifest.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { shots: {} };
}
export function writeManifest(m) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(m, null, 2));
}
