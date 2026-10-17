// npm run prep-rec [-- --force]
// Makes an edit-friendly copy of each founder recording named in edl.json: public/rec/prepared/<name>.mp4
// at 30 fps with a keyframe every second and no audio (the film mutes recordings), so the renderer
// can jump between the EDL's segments without decoding seconds of video for every cut. Times are
// unchanged, so edl.json keeps pointing at the original file's seconds. A copy is remade only when
// its recording changes (size and modification time, kept in prepared/index.json).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath } from "../capture/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const PUB = path.join(VIDEO, "public");
const OUT = path.join(PUB, "rec", "prepared");
const force = process.argv.includes("--force");
const edl = JSON.parse(fs.readFileSync(path.join(VIDEO, "edl.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const indexFile = path.join(OUT, "index.json");
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : {};

for (const who of ["owner", "buyer", "owner2"]) {
  const rec = edl[who];
  if (!rec?.file) continue;
  const src = path.join(PUB, rec.file);
  if (!fs.existsSync(src)) {
    console.log(`${who}: ${rec.file} not there yet`);
    continue;
  }
  const name = path.basename(rec.file).replace(/\.[a-z0-9]+$/i, "");
  const out = path.join(OUT, `${name}.mp4`);
  const st = fs.statSync(src);
  const fp = `${st.size}:${Math.round(st.mtimeMs)}`;
  if (!force && index[rec.file] === fp && fs.existsSync(out)) {
    console.log(`${who}: prepared copy is current (${path.relative(VIDEO, out)})`);
    continue;
  }
  console.log(`${who}: preparing ${rec.file} → ${path.relative(VIDEO, out)} …`);
  const tmp = out + ".part.mp4";
  const r = spawnSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-an", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed preparing ${rec.file}`);
  fs.renameSync(tmp, out);
  index[rec.file] = fp;
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}
