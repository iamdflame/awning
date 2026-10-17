// npm run captions [-- --model small.en] [--no-whisper]
//
// Prepares the narration for the film and times every word of it:
//   1. picks each line's take: public/audio/vo-0N.mp3 (or .wav), else the scratch voice;
//   2. writes a loudness-normalised copy (-16 LUFS, -1.5 dBTP) to public/audio/norm/vo-0N.wav;
//   3. times the words: whisper.cpp (@remotion/install-whisper-cpp, DTW token timestamps) on the
//      take, aligned to the script in src/vo.json, so captions use the script's exact words; the
//      scratch voice uses its phrase timings instead;
//   4. normalises the music bed (public/audio/music.mp3 from the founder, else the licensed stock
//      track) to public/audio/norm/music.wav;
//   5. writes public/audio/timing.json, which the film reads (src/data.ts).
// Prints any script word whisper did not hear, so a changed take never slips through silently.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath } from "../capture/lib.mjs";
import { scriptWords, wordsFromPhrases } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "..");
const PUB = path.join(VIDEO, "public");
const AUDIO = path.join(PUB, "audio");
const NORM = path.join(AUDIO, "norm");
const vo = JSON.parse(fs.readFileSync(path.join(VIDEO, "src", "vo.json"), "utf8"));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MODEL = opt("--model", "small.en");
const WHISPER_VERSION = "1.5.5";
const WHISPER_DIR = path.join(VIDEO, "whisper.cpp");
const FF = ffmpegPath();
fs.mkdirSync(NORM, { recursive: true });

const rel = (p) => path.relative(PUB, p).split(path.sep).join("/");
const exists = (p) => fs.existsSync(p);

/** run ffmpeg; returns its log (stderr), throws with the tail of it on failure */
function ffStderr(a) {
  const r = spawnSync(FF, a, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr).slice(-600)}`);
  return r.stderr;
}

/** two-pass loudness normalisation (linear when the peaks allow it), resampled to 48 kHz mono */
function normalise(src, out, target, tp) {
  const log = ffStderr(["-hide_banner", "-nostats", "-i", src, "-af", `loudnorm=I=${target}:TP=${tp}:LRA=11:print_format=json`, "-f", "null", "-"]);
  const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
  const af = `loudnorm=I=${target}:TP=${tp}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
  ffStderr(["-hide_banner", "-nostats", "-y", "-i", src, "-af", af, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", out]);
  return { inputLufs: Number(m.input_i), inputTp: Number(m.input_tp) };
}

function durationMs(file) {
  const out = ffStderr(["-hide_banner", "-i", file, "-f", "null", "-"]);
  const t = [...out.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].pop();
  return t ? Math.round((Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3])) * 1000) : 0;
}

// ---------- whisper ----------
let whisper = null;
async function whisperReady() {
  if (whisper) return whisper;
  const w = await import("@remotion/install-whisper-cpp");
  await w.installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
  await w.downloadWhisperModel({ folder: WHISPER_DIR, model: MODEL, printOutput: false });
  whisper = w;
  return w;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
  return String(n);
}
/** normalised sub-tokens of a word, for matching what was said against what was written */
function norm(word) {
  let w = word.toLowerCase().replace(/[’']/g, "'");
  w = w.replace(/\$(\d+)(\.\d+)?/g, (_, d) => `${numWords(Number(d))} dollars`);
  w = w.replace(/\b(\d+)\b/g, (_, d) => numWords(Number(d)));
  w = w.replace(/awe-ning|awe ning|owning|awning/g, "awning");
  w = w.replace(/u-s-d-c|u\.s\.d\.c\.?|usdc/g, "usdc");
  w = w.replace(/\.sh\b/g, " dot s h").replace(/s-h/g, "s h");
  w = w.replace(/[-–—]/g, " ").replace(/[^a-z0-9' ]/g, " ");
  return w.split(/\s+/).filter(Boolean);
}
function sim(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

/** whisper words (with times) → one {s, e} per script word; unmatched words are interpolated */
function align(script, heard) {
  const S = script.flatMap((w, i) => norm(w).map((t) => ({ t, i })));
  const H0 = heard.flatMap((w) => norm(w.w).map((t) => ({ t, s: w.s, e: w.e })));
  // whisper writes some compounds as two words ("pay box"): join them back
  const H = [];
  for (let k = 0; k < H0.length; k++) {
    const pair = H0[k + 1] ? H0[k].t + H0[k + 1].t : null;
    if (pair && S.some((x) => x.t === pair) && !S.some((x) => x.t === H0[k].t)) {
      H.push({ t: pair, s: H0[k].s, e: H0[k + 1].e });
      k++;
    } else H.push(H0[k]);
  }
  const n = S.length, m = H.length;
  const GAP = -0.6;
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const back = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
  for (let i = 1; i <= n; i++) { score[i][0] = i * GAP; back[i][0] = 1; }
  for (let j = 1; j <= m; j++) { score[0][j] = j * GAP; back[0][j] = 2; }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const s = sim(S[i - 1].t, H[j - 1].t);
      const diag = score[i - 1][j - 1] + (s >= 0.6 ? s : -1);
      const up = score[i - 1][j] + GAP;
      const left = score[i][j - 1] + GAP;
      if (diag >= up && diag >= left) { score[i][j] = diag; back[i][j] = 0; }
      else if (up >= left) { score[i][j] = up; back[i][j] = 1; }
      else { score[i][j] = left; back[i][j] = 2; }
    }
  const times = script.map(() => ({ s: null, e: null }));
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && back[i][j] === 0) {
      if (sim(S[i - 1].t, H[j - 1].t) >= 0.6) {
        const t = times[S[i - 1].i];
        t.s = t.s == null ? H[j - 1].s : Math.min(t.s, H[j - 1].s);
        t.e = t.e == null ? H[j - 1].e : Math.max(t.e, H[j - 1].e);
      }
      i--; j--;
    } else if (i > 0 && (j === 0 || back[i][j] === 1)) i--;
    else j--;
  }
  const missing = script.filter((_, k) => times[k].s == null);
  // interpolate the words whisper did not hear (by letters) between their timed neighbours
  for (let k = 0; k < script.length; k++) {
    if (times[k].s != null) continue;
    let a = k - 1;
    while (a >= 0 && times[a].e == null) a--;
    let b = k;
    while (b < script.length && times[b].s == null) b++;
    const t0 = a >= 0 ? times[a].e : heard[0]?.s ?? 300;
    const t1 = b < script.length ? times[b].s : heard[heard.length - 1]?.e ?? t0 + 400;
    const span = script.slice(a + 1, b);
    const weights = span.map((w) => Math.max(2, w.length));
    const total = weights.reduce((x, y) => x + y, 0);
    let t = t0;
    span.forEach((_, q) => {
      const d = ((t1 - t0) * weights[q]) / total;
      times[a + 1 + q] = { s: Math.round(t), e: Math.round(t + d) };
      t += d;
    });
    k = b - 1;
  }
  return { words: script.map((w, k) => ({ w, s: times[k].s, e: Math.max(times[k].s + 60, times[k].e) })), missing };
}

async function whisperWords(file) {
  const w = await whisperReady();
  const wav16 = path.join(NORM, path.basename(file, path.extname(file)) + ".16k.wav");
  ffStderr(["-hide_banner", "-y", "-i", file, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav16]);
  const res = await w.transcribe({ inputPath: wav16, whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_VERSION, model: MODEL, modelFolder: WHISPER_DIR, tokenLevelTimestamps: true, language: "en", printOutput: false });
  fs.rmSync(wav16, { force: true });
  const words = [];
  for (const item of res.transcription) {
    for (const tok of item.tokens) {
      if (/^\s*\[_|^\s*\[/.test(tok.text) || !tok.text.trim()) continue;
      const at = tok.t_dtw != null && tok.t_dtw >= 0 ? tok.t_dtw * 10 : tok.offsets.from;
      if (/^\s/.test(tok.text) || !words.length) words.push({ w: tok.text.trim(), s: at, e: tok.offsets.to });
      else {
        const last = words[words.length - 1];
        last.w += tok.text;
        last.e = tok.offsets.to;
      }
    }
  }
  // a word ends where the next one starts (DTW gives starts; offsets.to runs long)
  for (let k = 0; k < words.length - 1; k++) words[k].e = Math.min(words[k].e, words[k + 1].s);
  return { words, text: res.transcription.map((t) => t.text).join("").trim() };
}

// ---------- main ----------
const prev = exists(path.join(AUDIO, "timing.json")) ? JSON.parse(fs.readFileSync(path.join(AUDIO, "timing.json"), "utf8")) : {};
const fingerprint = (p) => {
  const st = fs.statSync(p);
  return `${st.size}:${Math.round(st.mtimeMs)}`;
};
const timing = {};
const report = [];
for (const line of vo.lines) {
  const id = line.id;
  const cands = [[path.join(AUDIO, `${id}.mp3`), "final"], [path.join(AUDIO, `${id}.wav`), "final"], [path.join(AUDIO, "scratch", `${id}.wav`), "scratch"]];
  const hit = cands.find(([p]) => exists(p));
  if (!hit) {
    report.push(`${id}: no audio yet`);
    continue;
  }
  const [src, kind] = hit;
  const out = path.join(NORM, `${id}.wav`);
  // unchanged take, same script: keep the work already done
  const p = prev[id];
  if (!args.includes("--force") && p && p.src === rel(src) && p.fp === fingerprint(src) && p.text === line.text && p.words && exists(out)) {
    timing[id] = p;
    report.push(`${id}: unchanged (${(p.durationMs / 1000).toFixed(2)} s, ${p.method})`);
    continue;
  }
  const lufs = normalise(src, out, -16, -1.5);
  const dur = durationMs(out);
  const script = scriptWords(line.text);
  let words;
  let method;
  let note = "";
  if (kind === "final" && !args.includes("--no-whisper")) {
    const heard = await whisperWords(out);
    const a = align(script, heard.words);
    words = a.words;
    method = `whisper ${MODEL} + script alignment`;
    if (a.missing.length) note = `  not heard: ${a.missing.join(" ")}`;
    note += `\n      heard: ${heard.text}`;
  } else if (kind === "scratch" && exists(path.join(AUDIO, "scratch", `${id}.phrases.json`))) {
    const ph = JSON.parse(fs.readFileSync(path.join(AUDIO, "scratch", `${id}.phrases.json`), "utf8").replace(/^﻿/, ""));
    words = wordsFromPhrases(line.text, ph.phrases);
    method = "scratch phrase timings";
  } else {
    words = null;
    method = "none (the film estimates)";
  }
  timing[id] = { src: rel(src), fp: fingerprint(src), text: line.text, kind, durationMs: dur, words, method, norm: rel(out), loudness: lufs };
  report.push(`${id}: ${kind} ${(dur / 1000).toFixed(2)} s, ${lufs.inputLufs} LUFS → -16, ${method}${note}`);
}

// the music bed
const musicSrc = [path.join(AUDIO, "music.mp3"), path.join(AUDIO, "stock-music.mp3")].find(exists);
if (musicSrc) {
  const out = path.join(NORM, "music.wav");
  const p = prev.music;
  if (!args.includes("--force") && p && p.src === rel(musicSrc) && p.fp === fingerprint(musicSrc) && exists(out)) {
    timing.music = p;
    report.push(`music: unchanged (${p.src})`);
  } else {
    const l = normalise(musicSrc, out, -18, -2);
    timing.music = { src: rel(musicSrc), fp: fingerprint(musicSrc), norm: rel(out), loudness: l };
    report.push(`music: ${rel(musicSrc)} ${l.inputLufs} LUFS → -18`);
  }
}
fs.writeFileSync(path.join(AUDIO, "timing.json"), JSON.stringify(timing, null, 2));
console.log(report.join("\n"));
console.log(`→ ${path.relative(VIDEO, path.join(AUDIO, "timing.json"))}`);
