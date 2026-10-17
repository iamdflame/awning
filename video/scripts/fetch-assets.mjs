// npm run assets [-- --force] [--no-verify]
// Downloads every third-party file listed in assets.json (stock footage, the music bed, sound
// effects, fonts) into public/. Before taking a Mixkit clip it re-reads the clip's page and refuses
// anything that is not under the Stock Video FREE license (Mixkit also has a Restricted,
// non-commercial license). Files already present are kept unless --force.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath } from "../capture/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(VIDEO, "assets.json"), "utf8"));
const args = process.argv.slice(2);
const force = args.includes("--force");
const verify = !args.includes("--no-verify");
const onlyGroup = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 awning-video-assets";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asText) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(120000) });
      if (r.status === 429) {
        await sleep(20000 * (i + 1));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asText ? await r.text() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === 4) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * (i + 1));
    }
  }
}

let failed = 0;
for (const group of ["fonts", "sfx", "music", "stock"]) {
  if (onlyGroup && group !== onlyGroup) continue;
  for (const item of manifest[group] ?? []) {
    const out = path.join(VIDEO, item.file);
    if (fs.existsSync(out) && !force) {
      console.log(`  have ${item.file}`);
      continue;
    }
    try {
      if (verify && item.pageLicenseMarker) {
        const page = await get(item.page, true);
        const markers = [...page.matchAll(/data-license="(video[A-Za-z]+)"/g)].map((m) => m[1]);
        if (!markers.includes(item.pageLicenseMarker) || markers.includes("videoRestricted")) throw new Error(`license on ${item.page} is now ${markers.join(",") || "unknown"}, not ${item.pageLicenseMarker}: not downloading`);
        await sleep(1500);
      }
      const buf = await get(item.url, false);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (group === "stock") {
        // stock arrives at 24/25 fps with its own timestamps: re-encode the first 14 s as clean
        // 30 fps H.264 (no audio) so every frame the film asks for exists
        const src = out + ".src.mp4";
        fs.writeFileSync(src, buf);
        const r = spawnSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-t", "14", "-an", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-g", "15", "-bf", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { encoding: "utf8" });
        fs.rmSync(src, { force: true });
        if (r.status !== 0) throw new Error("re-encode failed: " + r.stderr.slice(-300));
      } else fs.writeFileSync(out, buf);
      console.log(`  got  ${item.file} (${(buf.length / 1e6).toFixed(2)} MB) ← ${item.title}, ${item.license}`);
    } catch (e) {
      failed++;
      console.error(`  FAIL ${item.file}: ${e.message}`);
    }
  }
}
console.log(failed ? `${failed} file(s) failed` : "all assets present");
process.exit(failed ? 1 : 0);
