// npm run review [-- --scale 0.5] [--scenes s1-open,s7-hood] [--at 0.2,0.5,0.85] [--comp Main]
// Creative-director pass: renders stills at each scene's key moments (out/review/<scene>-<pct>.png)
// and prints the film's timeline, so every scene can be looked at frame by frame.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const scale = Number(opt("--scale", "0.5"));
const only = opt("--scenes")?.split(",");
const fractions = opt("--at", "0.2,0.55,0.9").split(",").map(Number);
const frames = opt("--frames")?.split(",").map(Number);
const compId = opt("--comp", "Main");
const out = path.join(VIDEO, "out", "review");
fs.mkdirSync(out, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src", "index.ts"), publicDir: path.join(VIDEO, "public") });
const comp = await selectComposition({ serveUrl, id: compId, inputProps: {} });
const tl = comp.props.timeline;
console.log(`${compId}: ${comp.durationInFrames} frames (${(comp.durationInFrames / comp.fps).toFixed(2)} s)`);
for (const s of tl?.scenes ?? []) {
  const take = s.vo ? comp.props.takes[s.vo] : null;
  console.log(`  ${s.id.padEnd(11)} ${String(s.from).padStart(5)} → ${String(s.from + s.frames).padStart(5)}  (${(s.frames / 30).toFixed(2)} s) voice@${s.voAt} ${take ? `${take.kind} ${take.durationSec.toFixed(2)} s${take.approx ? " ~words" : ""}` : ""}  next ${s.next.kind}`);
}
const jobs = [];
if (frames) for (const f of frames) jobs.push({ name: `${compId}-f${f}`, frame: f });
else
  for (const s of tl?.scenes ?? []) {
    if (only && !only.includes(s.id)) continue;
    for (const fr of fractions) jobs.push({ name: `${s.id}-${Math.round(fr * 100)}`, frame: Math.min(comp.durationInFrames - 1, s.from + Math.round(s.frames * fr)) });
  }
for (const j of jobs) {
  await renderStill({ serveUrl, composition: comp, frame: j.frame, output: path.join(out, `${j.name}.png`), scale, inputProps: comp.props, chromiumOptions: { gl: "angle" } });
  console.log(`  still ${j.name} @${j.frame}`);
}
