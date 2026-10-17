import React from "react";
import { Audio, Easing, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Clip } from "./Clip";
import edlJson from "../../edl.json";
import { BrowserFrame } from "./BrowserFrame";
import { C, EASE, FONT, receipt } from "../brand/tokens";
import { PROMPTS } from "../story";

type Rect = [number, number, number, number];
/** A camera key: from `at` (recording seconds) the view moves to frame `rect` over `dur` seconds
 *  (0 = a cut); rect null = the whole page. `pad` adds air around the rect (default 1.08). */
type ZoomKey = { at: number; rect: Rect | null; dur?: number; pad?: number };
type Beat = {
  what: string;
  url?: string | null;
  segments: [number, number][];
  type?: { start: number | null; end: number | null; prompt: keyof typeof PROMPTS; paste?: boolean };
  approve?: { at: number | null; rect: Rect };
  zoom: ZoomKey[];
  blur: { from: number; to: number; rect: Rect; label?: string }[];
  mark?: { at: number; rect: Rect; until?: number }[];
  /** dims everything outside rect (a spotlight on what matters; nothing is altered) */
  focus?: { from: number; to: number; rect: Rect; dim?: number }[];
  /** soft fades at the window's edges (fractions of its width), so text the camera crops trails off */
  fade?: { left?: number; right?: number };
};
type Rec = { file: string; url: string; crop: Rect; theme?: "light" | "dark"; bg?: string; beats: Record<string, Beat> };
export type Who = "owner" | "buyer" | "owner2";
const EDL = edlJson as unknown as Record<Who, Rec>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SRC_ASPECT = 16 / 9;

export function recOf(who: Who): Rec {
  return EDL[who];
}

export function beatOf(who: Who, beat: string): Beat {
  const b = EDL[who].beats[beat];
  if (!b) throw new Error(`edl.json has no beat ${who}.${beat}`);
  return b;
}

function segmentsOf(b: Beat): [number, number][] {
  return (b.segments ?? []).filter((s) => Array.isArray(s) && s[0] != null && s[1] != null && s[1] > s[0]);
}

export function beatIsReal(who: Who, beat: string, file: string | null): boolean {
  return !!file && segmentsOf(beatOf(who, beat)).length > 0;
}

/** Recording seconds shown at output frame f of a beat (segments played back to back, last frame held). */
export function sourceTime(b: Beat, f: number, fps: number): number {
  let acc = 0;
  const segs = segmentsOf(b);
  for (const [a, z] of segs) {
    const len = Math.round((z - a) * fps);
    if (f < acc + len) return a + (f - acc) / fps;
    acc += len;
  }
  const last = segs[segs.length - 1];
  return last ? last[1] - 1 / fps : 0;
}

/** Output frame (within the beat) at which recording time t is shown, or null when cut away. */
export function frameOfSource(b: Beat, t: number, fps: number): number | null {
  let acc = 0;
  for (const [a, z] of segmentsOf(b)) {
    if (t >= a && t <= z) return acc + Math.round((t - a) * fps);
    acc += Math.round((z - a) * fps);
  }
  return null;
}

export function beatFrames(b: Beat, fps: number): number {
  return segmentsOf(b).reduce((s, [a, z]) => s + Math.round((z - a) * fps), 0);
}

/** How far the prompt has been typed at frame f: from the recording when real, simulated otherwise. */
export function typingProgress(who: Who, beat: string, real: boolean, f: number, fps: number, slot: number): number | null {
  const b = beatOf(who, beat);
  if (!b.type) return null;
  if (real && b.type.start != null && b.type.end != null) {
    const t = sourceTime(b, f, fps);
    if (b.type.paste || b.type.end <= b.type.start) return t >= b.type.start ? 1 : 0;
    return interpolate(t, [b.type.start, b.type.end], [0, 1], clamp);
  }
  return interpolate(f, [8, Math.max(20, slot * 0.42)], [0, 1], clamp);
}

/** The camera window (center x, y and width, as fractions of the recording) at recording time t. */
function windowAt(rec: Rec, b: Beat, t: number, W: number, H: number) {
  const k = SRC_ASPECT * (H / W); // normalized height of a window of normalized width 1
  const [cx, cy, cw, ch] = rec.crop;
  const bw = Math.min(cw, ch / k);
  const base = { x: cx + cw / 2, y: cy + ch / 2, w: bw };
  const fit = (r: Rect | null, pad = 1.08) => {
    if (!r) return base;
    const w = Math.min(bw, Math.max(r[2] * pad, (r[3] * pad) / k));
    return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, w };
  };
  let cur = base;
  const keys = [...(b.zoom ?? [])].filter((z) => z && z.at != null).sort((a, z) => a.at - z.at);
  for (const key of keys) {
    const target = fit(key.rect, key.pad);
    const dur = key.dur ?? 0.8;
    const p = dur <= 0 ? (t >= key.at ? 1 : 0) : interpolate(t, [key.at, key.at + dur], [0, 1], { ...clamp, easing: EASE.inOut });
    if (p <= 0) break;
    cur = { x: cur.x + (target.x - cur.x) * p, y: cur.y + (target.y - cur.y) * p, w: Math.exp(Math.log(cur.w) + (Math.log(target.w) - Math.log(cur.w)) * p) };
  }
  // keep the window inside the crop
  const h = cur.w * k;
  const x = Math.min(cx + cw - cur.w / 2, Math.max(cx + cur.w / 2, cur.x));
  const y = Math.min(cy + ch - h / 2, Math.max(cy + h / 2, cur.y));
  return { x, y, w: cur.w, h };
}

const pct = (r: Rect): React.CSSProperties => ({ position: "absolute", left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` });

/** The edit-friendly copy of a recording (30 fps, a keyframe every second), made by scripts/prep-rec.mjs. */
export function playable(file: string): string {
  const name = file.split("/").pop()!.replace(/\.[a-z0-9]+$/i, "");
  return `rec/prepared/${name}.mp4`;
}

/**
 * A beat of the founder's recording in its window: the segments back to back at normal speed, a
 * camera that frames the EDL's zoom rects (cuts or glides), opaque redaction boxes over the owner
 * token and anything private, a tomato underline under the line that matters, and a ring on the
 * PayBox approval (with a chime). Without the file or segments: a clearly marked placeholder.
 */
export const RecordingBeat: React.FC<{ who: Who; beat: string; file: string | null; width: number; height: number; slot: number; chime?: string | null; style?: React.CSSProperties }> = ({
  who,
  beat,
  file,
  width,
  height,
  slot,
  chime,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rec = EDL[who];
  const b = beatOf(who, beat);
  const real = beatIsReal(who, beat, file);
  const dark = rec.theme === "dark";
  let body: React.ReactNode;
  if (!real) {
    body = <Placeholder who={who} beat={beat} b={b} width={width} height={height} slot={slot} />;
  } else {
    const src = staticFile(file!);
    const t = sourceTime(b, f, fps);
    const win = windowAt(rec, b, t, width, height);
    const vw = width / win.w; // px width of the whole recording at this zoom
    const vh = vw / SRC_ASPECT;
    const left = width / 2 - win.x * vw;
    const top = height / 2 - win.y * vh;
    const segs = segmentsOf(b);
    let acc = 0;
    const total = beatFrames(b, fps);
    const lastSeg = segs[segs.length - 1]!;
    const approveAge = b.approve?.at != null ? t - b.approve.at : null;
    const approveFrame = b.approve?.at != null ? frameOfSource(b, b.approve.at, fps) : null;
    body = (
      <div style={{ position: "absolute", left, top, width: vw, height: vh }}>
        {segs.map(([a, z], i) => {
          const from = acc;
          const len = Math.round((z - a) * fps);
          acc += len;
          return (
            <Sequence key={i} from={from} durationInFrames={len} layout="none">
              <Clip src={src} trimBefore={Math.round(a * fps)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            </Sequence>
          );
        })}
        {f >= total ? (
          <Freeze frame={Math.round(lastSeg[1] * fps) - 1}>
            <Clip src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          </Freeze>
        ) : null}
        {(b.focus ?? [])
          .filter((x) => t >= x.from && t <= x.to)
          .map((x, i) => (
            <div key={`focus-${i}`} style={{ ...pct(x.rect), borderRadius: 14, boxShadow: `0 0 0 9999px rgba(12,12,12,${x.dim ?? 0.8})`, pointerEvents: "none" }} />
          ))}
        {(b.mark ?? [])
          .filter((m) => t >= m.at && (m.until == null || t <= m.until))
          .map((m, i) => {
            const p = interpolate(t, [m.at, m.at + 0.35], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            return <div key={i} style={{ ...pct(m.rect), height: 0, top: `${(m.rect[1] + m.rect[3]) * 100}%`, borderTop: `${Math.max(3, vw / 520)}px solid ${C.tomato}`, borderRadius: 3, width: `${m.rect[2] * 100 * p}%` }} />;
          })}
        {(b.blur ?? [])
          .filter((x) => t >= x.from && t <= x.to)
          .map((x, i) => (
            // opaque, not a blur: nothing of a secret survives compression or a sharpening filter
            <div key={i} style={{ ...pct(x.rect), borderRadius: 8, background: dark ? "#2a2a2a" : C.c200, display: "flex", alignItems: "center", paddingLeft: "1.2%", overflow: "hidden" }}>
              <span style={{ ...receipt(Math.max(10, vw / 120), { color: dark ? "#8f8f8f" : C.c700, whiteSpace: "nowrap" }) }}>{x.label ?? "hidden"}</span>
            </div>
          ))}
        {b.approve && approveAge != null && approveAge >= -0.2 && approveAge <= 2.6 ? <ApproveRing rect={b.approve.rect} age={approveAge} /> : null}
        {chime && approveFrame != null ? (
          <Sequence from={approveFrame} durationInFrames={Math.round(fps * 2)} layout="none">
            <Audio src={staticFile(chime)} volume={0.32} />
          </Sequence>
        ) : null}
      </div>
    );
  }
  const bg = rec.bg ?? (dark ? "#141414" : C.c50);
  const edges =
    real && b.fade ? (
      <>
        {b.fade.left ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${b.fade.left * 100}%`, background: `linear-gradient(90deg, ${bg}, ${bg}00)`, pointerEvents: "none" }} /> : null}
        {b.fade.right ? <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${b.fade.right * 100}%`, background: `linear-gradient(270deg, ${bg}, ${bg}00)`, pointerEvents: "none" }} /> : null}
      </>
    ) : null;
  return (
    <BrowserFrame width={width} height={height} url={b.url ?? rec.url} dark={dark} style={style}>
      {body}
      {edges}
    </BrowserFrame>
  );
};

const ApproveRing: React.FC<{ rect: Rect; age: number }> = ({ rect, age }) => {
  const p = interpolate(age, [-0.2, 0.25], [0, 1], { ...clamp, easing: EASE.out });
  const out = interpolate(age, [2.1, 2.6], [1, 0], clamp);
  const pulse = 1 + 0.04 * Math.max(0, Math.sin(age * 7)) * Math.exp(-age * 1.5);
  return (
    <div
      style={{
        ...pct(rect),
        border: `6px solid ${C.tomato}`,
        borderRadius: 22,
        boxShadow: `0 0 0 9999px rgba(0,25,15,${0.38 * p * out}), 0 0 40px rgba(235,75,53,.5)`,
        opacity: p * out,
        transform: `scale(${(1.08 - 0.08 * p) * pulse})`,
      }}
    />
  );
};

/** What fills the frame until the founder's file and EDL segments exist. */
const Placeholder: React.FC<{ who: Who; beat: string; b: Beat; width: number; height: number; slot: number }> = ({ who, beat, b, width, height, slot }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rec = EDL[who];
  const typed = b.type ? PROMPTS[b.type.prompt] : null;
  const p = typingProgress(who, beat, false, f, fps, slot) ?? 0;
  const appr = b.approve ? interpolate(f, [slot * 0.55, slot * 0.62], [0, 1], clamp) : 0;
  const dark = rec.theme === "dark";
  const flow = who === "buyer" ? "BUYER FLOW: A FRESH CLAUDE CHAT + PAYBOX" : "OWNER FLOW: CLAUDE + PAYBOX";
  return (
    <div style={{ position: "absolute", inset: 0, background: dark ? "repeating-linear-gradient(135deg, #1a1d1b 0 26px, #141414 26px 52px)" : `repeating-linear-gradient(135deg, ${C.c100} 0 26px, ${C.c50} 26px 52px)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 60 }}>
      <div style={{ ...receipt(20, { fontWeight: 700, letterSpacing: "0.08em", color: dark ? "#ff8a75" : C.tomatoDeep, textAlign: "center" }) }}>
        PLACEHOLDER · {flow} · {rec.file.replace("rec/", "")}
      </div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 54, letterSpacing: "-0.025em", color: dark ? C.c50 : C.c900, textAlign: "center", lineHeight: 1.05 }}>
        Founder recording goes here: {who === "buyer" ? "buyer" : "owner"} flow
      </div>
      <div style={{ fontFamily: FONT.text, fontSize: 27, color: dark ? "rgba(247,246,237,.7)" : C.c700, textAlign: "center", maxWidth: width * 0.78, lineHeight: 1.4 }}>
        <b style={{ color: dark ? C.c50 : C.c900 }}>{beat}</b> · {b.what}
      </div>
      {typed ? (
        <div
          style={
            dark
              ? { marginTop: 10, maxWidth: width * 0.78, padding: "20px 28px", borderRadius: "24px 24px 8px 24px", background: "#2b2b2a", fontFamily: FONT.text, fontSize: 30, lineHeight: 1.35, color: "#ededed" }
              : { marginTop: 10, maxWidth: width * 0.78, padding: "22px 30px", borderRadius: "26px 26px 8px 26px", background: C.c0, boxShadow: "0 10px 30px rgba(0,41,25,.12)", fontFamily: FONT.text, fontSize: 30, lineHeight: 1.35, color: C.c900 }
          }
        >
          {typed.slice(0, Math.round(typed.length * p))}
          <span style={{ display: "inline-block", width: 3, height: 30, background: dark ? "#ededed" : C.c900, marginLeft: 3, verticalAlign: -4, opacity: Math.floor(f / 15) % 2 ? 1 : 0.2 }} />
        </div>
      ) : null}
      {b.approve ? (
        <div style={{ opacity: appr, transform: `scale(${0.94 + 0.06 * appr})`, padding: "14px 26px", borderRadius: 16, border: `5px solid ${C.tomato}`, fontFamily: FONT.text, fontWeight: 700, fontSize: 28, color: C.c900, background: C.c0 }}>PayBox approval: ringed here in the film</div>
      ) : null}
    </div>
  );
};

/** The prompt, typed in step with the recording (or simulated), as a large caption bubble. */
export const PromptBubble: React.FC<{ who: Who; beat: string; real: boolean; slot: number; width?: number; size?: number; style?: React.CSSProperties; label?: string }> = ({ who, beat, real, slot, width = 980, size = 38, style, label }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = beatOf(who, beat);
  if (!b.type) return null;
  const text = PROMPTS[b.type.prompt];
  const p = typingProgress(who, beat, real, f, fps, slot) ?? 0;
  const n = Math.round(text.length * p);
  const shown = interpolate(f, [0, 8], [0, 1], clamp);
  return (
    <div style={{ width, opacity: shown, transform: `translateY(${(1 - shown) * 16}px)`, ...style }}>
      <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: size * 0.52, color: C.c700, marginBottom: 12, letterSpacing: "0.01em" }}>{label ?? (who === "buyer" ? "A fresh chat, to Claude" : "The owner, to Claude")}</div>
      <div style={{ padding: `${size * 0.6}px ${size * 0.8}px`, borderRadius: `${size * 0.7}px ${size * 0.7}px ${size * 0.7}px ${size * 0.2}px`, background: C.c0, boxShadow: "0 18px 40px -12px rgba(0,41,25,.25), 0 2px 6px rgba(0,41,25,.08)", fontFamily: FONT.text, fontWeight: 500, fontSize: size, lineHeight: 1.32, color: C.c900, minHeight: size * 1.32 }}>
        {text.slice(0, n)}
        <span style={{ display: "inline-block", width: Math.max(3, size * 0.07), height: size * 0.95, background: C.g600, marginLeft: 3, verticalAlign: "-0.12em", opacity: n < text.length || Math.floor(f / 15) % 2 ? 1 : 0 }} />
      </div>
    </div>
  );
};
