// The film's clock. Pure functions (no imports) shared by calculateMetadata and the Node scripts.
//
// Every scene is built around one narration line: its length is the line's real audio duration plus
// designed breathing room (pre: before the voice starts, post: after it ends). Transitions overlap
// neighbouring scenes; the layout keeps voices from ever overlapping.

export const FPS = 30;

export type Word = { w: string; s: number; e: number }; // ms from the start of the audio file
export type Take = {
  id: string;
  src: string | null; // staticFile path of the audio used, null when no audio exists yet
  kind: "final" | "scratch" | "missing";
  durationSec: number;
  words: Word[];
  approx: boolean; // word times estimated (no timing file for this audio yet)
};

export type TransitionKind = "canopy" | "slide-left" | "slide-right" | "slide-up" | "fade" | "cut";
export type SceneSpec = {
  id: string;
  vo: string | null;
  pre: number; // seconds before the voice starts
  post: number; // seconds after the voice ends
  minSec?: number;
  fixedSec?: number; // a scene with no voice
  next?: { kind: TransitionKind; frames: number };
};

export type SceneTiming = {
  id: string;
  vo: string | null;
  from: number; // absolute frame
  frames: number; // duration in frames
  voAt: number; // frame (relative to the scene) where the voice starts
  voFrames: number;
  next: { kind: TransitionKind; frames: number };
};

export type Timeline = { fps: number; total: number; scenes: SceneTiming[] };

const sec = (s: number, fps: number) => Math.round(s * fps);

export function layout(specs: SceneSpec[], takes: Record<string, Take>, fps = FPS, gapSec = 0.3): Timeline {
  const scenes: SceneTiming[] = [];
  let cursor = 0;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const take = s.vo ? takes[s.vo] : undefined;
    const voFrames = take ? sec(take.durationSec, fps) : 0;
    const prev = scenes[i - 1];
    const inFrames = prev ? prev.next.frames : 0;
    let pre = sec(s.pre, fps);
    // the previous voice must end (plus a small gap) before this one starts
    if (prev && prev.vo && s.vo) {
      const prevVoEndAbs = prev.from + prev.voAt + prev.voFrames;
      const thisStart = cursor - inFrames;
      const minPre = prevVoEndAbs + sec(gapSec, fps) - thisStart;
      pre = Math.max(pre, minPre);
    }
    let frames = s.fixedSec != null ? sec(s.fixedSec, fps) : pre + voFrames + sec(s.post, fps);
    if (s.minSec) frames = Math.max(frames, sec(s.minSec, fps));
    const next = s.next ?? { kind: "cut", frames: 0 };
    // a transition can never be longer than half of either neighbour
    const from = cursor - inFrames;
    scenes.push({ id: s.id, vo: s.vo, from, frames, voAt: pre, voFrames, next: { ...next, frames: Math.min(next.frames, Math.floor(frames / 2)) } });
    cursor = from + frames;
  }
  const last = scenes[scenes.length - 1];
  return { fps, total: last ? last.from + last.frames : 1, scenes };
}

/** Frame (relative to the scene) at which a word of the scene's line starts; nth counts repeats. */
export function wordFrame(take: Take | undefined, timing: SceneTiming, match: string, nth = 0, fps = FPS): number {
  if (!take || !take.words.length) return timing.voAt;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9$.-]/g, "").replace(/\.$/, "");
  const want = norm(match);
  // exact words first ("On" must never land on "One"); a prefix only when nothing matches exactly
  for (const exact of [true, false]) {
    let seen = 0;
    for (const w of take.words) {
      const n = norm(w.w);
      if (exact ? n === want : n.startsWith(want)) {
        if (seen++ === nth) return timing.voAt + Math.round((w.s / 1000) * fps);
      }
    }
  }
  return timing.voAt;
}

/** Spoken intervals in absolute frames (for ducking the music under the voice). */
export function speechSpans(tl: Timeline, takes: Record<string, Take>, fps = FPS): [number, number][] {
  const spans: [number, number][] = [];
  for (const s of tl.scenes) {
    const t = s.vo ? takes[s.vo] : undefined;
    if (!t || t.kind === "missing" || !t.words.length) continue;
    let a = t.words[0]!.s;
    let b = t.words[0]!.e;
    for (const w of t.words.slice(1)) {
      if (w.s - b > 650) {
        spans.push([s.from + s.voAt + Math.round((a / 1000) * fps), s.from + s.voAt + Math.round((b / 1000) * fps)]);
        a = w.s;
      }
      b = w.e;
    }
    spans.push([s.from + s.voAt + Math.round((a / 1000) * fps), s.from + s.voAt + Math.round((b / 1000) * fps)]);
  }
  return spans;
}

// ---------- words ----------

/** The script's words, as spoken (punctuation kept on the word it follows). */
export function scriptWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Spread a line's words over phrases with known start/end (scratch voice), by letter count. */
export function wordsFromPhrases(text: string, phrases: { text: string; startMs: number; endMs: number }[]): Word[] {
  const words = scriptWords(text);
  const out: Word[] = [];
  let wi = 0;
  for (const p of phrases) {
    const pw = scriptWords(p.text);
    const weights = pw.map((w) => Math.max(2, w.replace(/[^A-Za-z0-9$]/g, "").length) + 1.2);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = p.startMs;
    for (let k = 0; k < pw.length && wi < words.length; k++, wi++) {
      const d = ((p.endMs - p.startMs) * weights[k]!) / total;
      out.push({ w: words[wi]!, s: Math.round(t), e: Math.round(t + d) });
      t += d;
    }
  }
  return out;
}

/** No timing file: spread the words over the audio, leaving the 0.3 s lead-in and tail. */
export function approxWords(text: string, durationSec: number): Word[] {
  const words = scriptWords(text);
  const start = 300;
  const end = Math.max(start + 500, durationSec * 1000 - 300);
  return wordsFromPhrases(text, [{ text, startMs: start, endMs: end }]);
}

// ---------- captions ----------

export type CaptionWord = { w: string; from: number; to: number }; // absolute frames
export type Caption = { from: number; to: number; words: CaptionWord[]; text: string };

/**
 * Captions are the script's words, timed by the take. Spoken forms are written as they read
 * ("two hundred" → "200", "awning dot S-H." → "awning.sh."): the same words, never a paraphrase.
 * Chunks break at sentence ends and stay within two lines (about 64 characters).
 */
export function buildCaptions(tl: Timeline, takes: Record<string, Take>, subs: { spoken: string; written: string }[], maxChars = 60, fps = FPS): Caption[] {
  const caps: Caption[] = [];
  for (const s of tl.scenes) {
    const t = s.vo ? takes[s.vo] : undefined;
    if (!t || !t.words.length) continue;
    const abs = (ms: number) => s.from + s.voAt + Math.round((ms / 1000) * fps);
    // apply written forms, merging the timing of the words they replace
    let words: CaptionWord[] = t.words.map((w) => ({ w: w.w, from: abs(w.s), to: abs(w.e) }));
    for (const sub of subs) {
      const sw = sub.spoken.split(/\s+/);
      for (let i = 0; i + sw.length <= words.length; i++) {
        const seq = words.slice(i, i + sw.length).map((x) => x.w.replace(/[,]$/, ""));
        if (seq.join(" ").toLowerCase() === sub.spoken.toLowerCase().replace(/[,]$/, "")) {
          const trail = words[i + sw.length - 1]!.w.match(/[,.:;]$/)?.[0] ?? "";
          const written = sub.written.replace(/[,.:;]$/, "") + (trail || sub.written.match(/[,.:;]$/)?.[0] || "");
          words.splice(i, sw.length, { w: written, from: words[i]!.from, to: words[i + sw.length - 1]!.to });
        }
      }
    }
    // sentences first; a short sentence joins the next when both fit; a long one is split into
    // balanced pieces at its most natural breaks (after a comma or colon, else before "and", "that"…)
    const sentences: CaptionWord[][] = [];
    let cur: CaptionWord[] = [];
    for (const w of words) {
      cur.push(w);
      if (/[.?!]$/.test(w.w)) {
        sentences.push(cur);
        cur = [];
      }
    }
    if (cur.length) sentences.push(cur);
    const text = (ws: CaptionWord[]) => ws.map((x) => x.w).join(" ");
    const push = (ws: CaptionWord[]) => caps.push({ from: ws[0]!.from, to: ws[ws.length - 1]!.to, words: ws, text: text(ws) });
    for (let i = 0; i < sentences.length; i++) {
      let sent = sentences[i]!;
      const nx = sentences[i + 1];
      if (nx && text(sent).length <= 20 && text(sent).length + 1 + text(nx).length <= maxChars) {
        sent = [...sent, ...nx];
        i++;
      }
      for (const piece of splitBalanced(sent, maxChars)) push(piece);
    }
  }
  // hold each caption until the next one (at most 0.7 s past its last word), never overlapping
  for (const c of caps) c.from = Math.max(0, c.from - 2); // a caption leads its first word slightly
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i]!;
    const nx = caps[i + 1];
    const hold = Math.round(0.7 * fps);
    c.to = Math.min(c.to + hold, nx ? nx.from - 1 : c.to + hold);
  }
  return caps;
}

const SOFT_BREAK_BEFORE = new Set(["and", "that", "so", "but", "or", "to", "with", "where", "who", "which", "after", "for", "in", "on", "at"]);

/** Split one sentence into the fewest, most even pieces of at most maxChars, at natural breaks. */
function splitBalanced(ws: CaptionWord[], maxChars: number): CaptionWord[][] {
  const len = (i: number, j: number) => ws.slice(i, j).map((x) => x.w).join(" ").length;
  const total = len(0, ws.length);
  if (total <= maxChars) return [ws];
  const n = ws.length;
  const pieces = Math.ceil(total / maxChars);
  const target = total / pieces;
  const breakCost = (j: number) => {
    // a break between ws[j-1] and ws[j]
    if (j >= n) return 0;
    if (/[,:;]$/.test(ws[j - 1]!.w)) return 0;
    if (SOFT_BREAK_BEFORE.has(ws[j]!.w.toLowerCase().replace(/[^a-z]/g, ""))) return 18;
    return 70;
  };
  const best: number[] = Array(n + 1).fill(Infinity);
  const prev: number[] = Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = 0; i < j; i++) {
      const bi = best[i]!;
      if (bi === Infinity) continue;
      const l = len(i, j);
      if (l > maxChars) continue;
      const short = l < 16 ? 260 : 0;
      const c = bi + ((l - target) * (l - target)) / target + breakCost(j) + short;
      if (c < best[j]!) {
        best[j] = c;
        prev[j] = i;
      }
    }
  }
  if (best[n] === Infinity) return [ws];
  const out: CaptionWord[][] = [];
  for (let j = n; j > 0; j = prev[j]!) out.unshift(ws.slice(prev[j]!, j));
  return out;
}

export function srt(caps: Caption[], fps = FPS): string {
  const ts = (f: number) => {
    const ms = Math.round((f / fps) * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const r = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
  };
  return caps.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n");
}
