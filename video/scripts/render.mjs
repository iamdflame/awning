// npm run render:main | render:30 | render:thumb | render:all   [-- --skip-prepare] [--preview]
//
//   main  → out/awning-demo-main.mp4 (1920×1080, 30 fps, H.264 CRF 16, AAC 192 kb/s) + out/awning-demo.srt
//   cut30 → out/awning-demo-30s.mp4
//   thumb → out/thumbnail.png (1280×720)
// Before rendering it prepares the narration (scripts/captions.mjs: loudness, word timings), and
// after rendering it measures the mix and brings it to -16 LUFS integrated, -1.5 dBTP (the video
// stream is copied untouched). --preview renders a half-size, fast draft to out/preview-<name>.mp4.
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath } from "../capture/lib.mjs";
import { srt } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const OUT = path.join(VIDEO, "out");
const args = process.argv.slice(2);
const what = args.find((a) => !a.startsWith("--")) ?? "all";
const preview = args.includes("--preview");
fs.mkdirSync(OUT, { recursive: true });

if (!args.includes("--skip-prepare")) {
  const r = spawnSync(process.execPath, [path.join(here, "captions.mjs")], { stdio: "inherit", cwd: VIDEO });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("bundling…");
const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src", "index.ts"), publicDir: path.join(VIDEO, "public") });

function loudnorm(file) {
  const FF = ffmpegPath();
  const m1 = spawnSync(FF, ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const log = m1.stderr;
  const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
  const tmp = file.replace(/\.mp4$/, ".loud.mp4");
  const af = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
  const r = spawnSync(FF, ["-hide_banner", "-nostats", "-y", "-i", file, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", tmp], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("loudness pass failed: " + r.stderr.slice(-400));
  fs.renameSync(tmp, file);
  console.log(`  mix: ${m.input_i} LUFS, ${m.input_tp} dBTP → -16 LUFS, -1.5 dBTP`);
}

async function video(id, file) {
  const comp = await selectComposition({ serveUrl, id, inputProps: {} });
  const out = path.join(OUT, preview ? `preview-${file}` : file);
  console.log(`${id}: ${comp.durationInFrames} frames (${(comp.durationInFrames / comp.fps).toFixed(2)} s) → ${path.relative(VIDEO, out)}`);
  if (id === "Main" && !preview) {
    fs.writeFileSync(path.join(OUT, "awning-demo.srt"), srt(comp.props.captions ?? [], comp.fps));
    console.log(`  captions → out/awning-demo.srt (${comp.props.captions?.length ?? 0} cues)`);
  }
  let last = -1;
  await renderMedia({
    serveUrl,
    composition: comp,
    inputProps: comp.props,
    codec: "h264",
    outputLocation: out,
    crf: preview ? 28 : 16,
    x264Preset: preview ? "veryfast" : "slow",
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    imageFormat: "jpeg",
    jpegQuality: preview ? 80 : 95,
    audioCodec: "aac",
    audioBitrate: "192k",
    scale: preview ? 0.5 : 1,
    // 3072x1728 product captures: fewer tabs at once and a patient frame timeout keep extraction steady
    concurrency: 6,
    timeoutInMilliseconds: 120000,
    chromiumOptions: { gl: "angle" },
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) {
        last = p;
        process.stdout.write(`  ${Math.round(progress * 100)}%\r`);
      }
    },
  });
  process.stdout.write("\n");
  if (!preview) loudnorm(out);
}

if (what === "main" || what === "all") await video("Main", "awning-demo-main.mp4");
if (what === "cut30" || what === "all") await video("Cut30", "awning-demo-30s.mp4");
if (what === "thumb" || what === "all") {
  const comp = await selectComposition({ serveUrl, id: "Thumbnail", inputProps: {} });
  await renderStill({ serveUrl, composition: comp, inputProps: comp.props, output: path.join(OUT, "thumbnail.png"), frame: 0, timeoutInMilliseconds: 120000, chromiumOptions: { gl: "angle" } });
  console.log("Thumbnail → out/thumbnail.png");
}
