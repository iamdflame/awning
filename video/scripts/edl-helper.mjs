// npm run edl-helper -- owner|buyer|owner2 [--every 1] [--from 0] [--to end] [--crop x,y,w,h] [--width 480] [--cols 6]
// Helps fill edl.json from a founder recording: extracts a frame every N seconds (optionally only
// between --from and --to, optionally cropped to a pixel rect of the recording) and lays them out
// as timestamped contact sheets (out/edl/<who>[-from-to]-NN.png, 60 frames per sheet), so in/out
// points, typing start/end, the approval moment and zoom/blur rects can be read off at a glance.
// Rect tip: a rect in edl.json is [x, y, w, h] as fractions of the frame; the sheets show a 10% grid
// of the whole frame (or of the crop).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ffmpegPath, launch } from "../capture/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const args = process.argv.slice(2);
const who = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))) ?? "owner";
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const every = Number(opt("--every", "1"));
const width = Number(opt("--width", "480"));
const cols = Number(opt("--cols", "6"));
const from = Number(opt("--from", "0"));
const to = opt("--to") != null ? Number(opt("--to")) : null;
const crop = opt("--crop")?.split(",").map(Number);
const edl = JSON.parse(fs.readFileSync(path.join(VIDEO, "edl.json"), "utf8"));
const rec = edl[who];
if (!rec) throw new Error(`edl.json has no recording "${who}" (owner, buyer, owner2)`);
const file = path.join(VIDEO, "public", rec.file);
if (!fs.existsSync(file)) throw new Error(`${rec.file} is not there yet`);

const tag = opt("--from") != null || to != null ? `${who}-${from}-${to ?? "end"}` : who;
const out = path.join(VIDEO, "out", "edl", tag);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// (Remotion's ffmpeg has no fps filter: the output rate -r picks the frames)
const vf = [crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}` : null, `scale=${width}:-2`].filter(Boolean).join(",");
const ff = ["-hide_banner", "-loglevel", "error", "-ss", String(from), ...(to != null ? ["-to", String(to)] : []), "-i", file, "-r", String(1 / every), "-vf", vf, path.join(out, "f%05d.png")];
const r = spawnSync(ffmpegPath(), ff, { encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr);
const frames = fs.readdirSync(out).filter((f) => /^f\d+\.png$/.test(f)).sort();
const per = cols * 10;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: cols * (width + 6), height: 800 } });
const sheets = [];
for (let i = 0; i < frames.length; i += per) {
  const cells = frames
    .slice(i, i + per)
    .map((f, k) => {
      const t = from + (i + k) * every;
      const mm = Math.floor(t / 60);
      const ss = (t % 60).toFixed(every < 1 ? 1 : 0).padStart(every < 1 ? 4 : 2, "0");
      return `<div style="position:relative;width:${width}px"><img src="${pathToFileURL(path.join(out, f)).href}" style="width:100%;display:block"><div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,0,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,0,.16) 1px,transparent 1px);background-size:10% 10%"></div><span style="position:absolute;left:6px;top:4px;background:#000c;color:#ff0;font:700 18px monospace;padding:1px 6px">${t.toFixed(every < 1 ? 1 : 0)}s (${mm}:${ss})</span></div>`;
    })
    .join("");
  const html = path.join(out, `sheet.html`);
  fs.writeFileSync(html, `<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${width}px);gap:6px">${cells}</body></html>`);
  await page.goto(pathToFileURL(html).href);
  await page.waitForTimeout(400);
  const name = path.join(VIDEO, "out", "edl", `${tag}-${String(i / per + 1).padStart(2, "0")}.png`);
  await page.screenshot({ path: name, fullPage: true });
  sheets.push(path.relative(VIDEO, name));
}
await browser.close();
console.log(`${rec.file}: ${frames.length} frames every ${every} s → ${sheets.join(", ")}`);
console.log(`Beats to fill in edl.json → ${who}: ${Object.keys(rec.beats).join(", ")}`);
