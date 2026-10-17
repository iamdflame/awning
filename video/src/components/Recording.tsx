import React from "react";
import { Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import edlJson from "../../edl.json";
import { BrowserFrame } from "./BrowserFrame";
import { TerminalFrame } from "./TerminalFrame";
import { C, EASE, FONT, receipt } from "../brand/tokens";
import { PROMPTS } from "../story";

type Rect = [number, number, number, number];
type Beat = {
  what: string;
  url?: string | null;
  segments: [number, number][];
  type?: { start: number | null; end: number | null; prompt: keyof typeof PROMPTS };
  approve?: { at: number | null; rect: Rect };
  zoom: { at: number; rect: Rect | null }[];
  blur: { from: number; to: number; rect: Rect }[];
};
type Rec = { file: string; url: string; crop: Rect; frame?: "browser" | "terminal"; title?: string; beats: Record<string, Beat> };
export type Who = "owner" | "buyer" | "owner2";
const EDL = edlJson as unknown as Record<Who, Rec>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SRC_ASPECT = 16 / 9;

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
    return interpolate(t, [b.type.start, b.type.end], [0, 1], clamp);
  }
  return interpolate(f, [8, Math.max(20, slot * 0.42)], [0, 1], clamp);
}

/** The camera window (x, y, w in source fractions) for a recording at source time t. */
function windowAt(rec: Rec, b: Beat, t: number, W: number, H: number) {
  const k = SRC_ASPECT * (H / W); // normalized height of a window of normalized width 1
  const [cx, cy, cw, ch] = rec.crop;
  const bw = Math.min(cw, ch / k);
  const base = { x: cx + cw / 2, y: cy + ch / 2, w: bw };
  const fit = (r: Rect | null) => {
    if (!r) return base;
    const w = Math.min(bw, Math.max(r[2] * 1.18, (r[3] * 1.18) / k));
    return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, w };
  };
  let cur = base;
  const keys = [...(b.zoom ?? [])].filter((z) => z && z.at != null).sort((a, z) => a.at - z.at);
  for (const key of keys) {
    const target = fit(key.rect);
    const p = interpolate(t, [key.at - 0.7, key.at], [0, 1], { ...clamp, easing: EASE.inOut });
    if (p <= 0) break;
    cur = { x: cur.x + (target.x - cur.x) * p, y: cur.y + (target.y - cur.y) * p, w: Math.exp(Math.log(cur.w) + (Math.log(target.w) - Math.log(cur.w)) * p) };
  }
  // keep the window inside the crop
  const h = cur.w * k;
  const x = Math.min(cx + cw - cur.w / 2, Math.max(cx + cur.w / 2, cur.x));
  const y = Math.min(cy + ch - h / 2, Math.max(cy + h / 2, cur.y));
  return { x, y, w: cur.w, h };
}

/**
 * A beat of the founder's recording in the browser frame: its segments back to back at normal
 * speed, a camera that frames the EDL's zoom rects, blurred boxes over the owner token, and a ring
 * on the PayBox approval (with a chime). Without the file or segments: a clearly marked placeholder.
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
  let body: React.ReactNode;
  if (!real) {
    body = <Placeholder who={who} beat={beat} b={b} width={width} height={height} slot={slot} />;
  } else {
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
              <OffthreadVideo src={staticFile(file!)} trimBefore={Math.round(a * fps)} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            </Sequence>
          );
        })}
        {f >= total ? (
          <Freeze frame={Math.round(lastSeg[1] * fps) - 1}>
            <OffthreadVideo src={staticFile(file!)} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          </Freeze>
        ) : null}
        {(b.blur ?? [])
          .filter((x) => t >= x.from && t <= x.to)
          .map((x, i) => (
            <div key={i} style={{ position: "absolute", left: `${x.rect[0] * 100}%`, top: `${x.rect[1] * 100}%`, width: `${x.rect[2] * 100}%`, height: `${x.rect[3] * 100}%`, borderRadius: 10, backdropFilter: "blur(16px)", background: "rgba(238,238,226,.55)" }} />
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
  if (rec.frame === "terminal")
    return (
      <TerminalFrame width={width} height={height} title={rec.title ?? "Claude Code"} style={style}>
        {body}
      </TerminalFrame>
    );
  return (
    <BrowserFrame width={width} height={height} url={b.url ?? rec.url} style={style}>
      {body}
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
        position: "absolute",
        left: `${rect[0] * 100}%`,
        top: `${rect[1] * 100}%`,
        width: `${rect[2] * 100}%`,
        height: `${rect[3] * 100}%`,
        border: `6px solid ${C.tomato}`,
        borderRadius: 22,
        boxShadow: `0 0 0 9999px rgba(0,25,15,${0.35 * p * out}), 0 0 40px rgba(235,75,53,.5)`,
        opacity: p * out,
        transform: `scale(${(1.08 - 0.08 * p) * pulse})`,
      }}
    />
  );
};

/** What fills the frame until the founder's file and EDL segments exist. */
const Placeholder: React.FC<{ who: Who; beat: string; b: Beat; width: number; height: number; slot: number }> = ({ who, beat, b, width, height, slot }) => {
  const f = useCurrentFrame();
  const rec = EDL[who];
  const { fps } = useVideoConfig();
  const typed = b.type ? PROMPTS[b.type.prompt] : null;
  const p = typingProgress(who, beat, false, f, fps, slot) ?? 0;
  const appr = b.approve ? interpolate(f, [slot * 0.55, slot * 0.62], [0, 1], clamp) : 0;
  const dark = rec.frame === "terminal";
  return (
    <div style={{ position: "absolute", inset: 0, background: dark ? "repeating-linear-gradient(135deg, #141816 0 26px, #0c0c0c 26px 52px)" : `repeating-linear-gradient(135deg, ${C.c100} 0 26px, ${C.c50} 26px 52px)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 60 }}>
      <div style={{ ...receipt(20, { fontWeight: 700, letterSpacing: "0.08em", color: C.tomatoDeep }) }}>PLACEHOLDER · {who === "buyer" ? "BUYER FLOW: CLAUDE CODE IN A TERMINAL + PAYBOX" : "OWNER FLOW: CLAUDE.AI + PAYBOX"} · {rec.file.replace("rec/", "")}</div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 54, letterSpacing: "-0.025em", color: dark ? C.c50 : C.c900, textAlign: "center", lineHeight: 1.05 }}>
        Founder recording goes here: {who === "buyer" ? "buyer" : "owner"} flow
      </div>
      <div style={{ fontFamily: FONT.text, fontSize: 27, color: dark ? "rgba(247,246,237,.7)" : C.c700, textAlign: "center", maxWidth: width * 0.72, lineHeight: 1.4 }}>
        <b style={{ color: dark ? C.c50 : C.c900 }}>{beat}</b> · {b.what}
      </div>
      {typed ? (
        <div style={dark ? { marginTop: 10, maxWidth: width * 0.84, padding: "18px 26px", borderRadius: 10, background: "#161a18", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", ...receipt(26, { lineHeight: 1.45, color: C.c50 }) } : { marginTop: 10, maxWidth: width * 0.78, padding: "22px 30px", borderRadius: "26px 26px 8px 26px", background: C.c0, boxShadow: "0 10px 30px rgba(0,41,25,.12)", fontFamily: FONT.text, fontSize: 30, lineHeight: 1.35, color: C.c900 }}>
          {dark ? <span style={{ color: C.g300 }}>{"> "}</span> : null}
          {typed.slice(0, Math.round(typed.length * p))}
          <span style={{ display: "inline-block", width: dark ? 14 : 3, height: 30, background: dark ? C.c50 : C.c900, marginLeft: 3, verticalAlign: -4, opacity: Math.floor(f / 15) % 2 ? 1 : 0.2 }} />
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
      <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: size * 0.52, color: C.c700, marginBottom: 12, letterSpacing: "0.01em" }}>{label ?? (who === "buyer" ? "A different agent: Claude Code, in a terminal" : "The owner, to Claude")}</div>
      <div style={{ padding: `${size * 0.6}px ${size * 0.8}px`, borderRadius: `${size * 0.7}px ${size * 0.7}px ${size * 0.7}px ${size * 0.2}px`, background: C.c0, boxShadow: "0 18px 40px -12px rgba(0,41,25,.25), 0 2px 6px rgba(0,41,25,.08)", fontFamily: FONT.text, fontWeight: 500, fontSize: size, lineHeight: 1.32, color: C.c900, minHeight: size * 1.32 }}>
        {text.slice(0, n)}
        <span style={{ display: "inline-block", width: Math.max(3, size * 0.07), height: size * 0.95, background: C.g600, marginLeft: 3, verticalAlign: "-0.12em", opacity: n < text.length || Math.floor(f / 15) % 2 ? 1 : 0 }} />
      </div>
    </div>
  );
};
