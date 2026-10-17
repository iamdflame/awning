import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT } from "../brand/tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Words rise into place from under a mask, one after another, on a spring. */
export const Rise: React.FC<{ at: number; children: string; stagger?: number; style?: React.CSSProperties; out?: number; lineGap?: number; wordStyle?: (i: number, w: string) => React.CSSProperties | undefined }> = ({
  at,
  children,
  stagger = 3,
  style,
  out,
  wordStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = children.split("\n");
  let k = 0;
  const leave = out != null ? interpolate(frame, [out, out + 10], [0, 1], { ...clamp, easing: EASE.inOut }) : 0;
  return (
    <div style={{ ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "block", whiteSpace: "nowrap" }}>
          {line.split(" ").map((w, wi) => {
            const i = k++;
            const p = spring({ frame: frame - at - i * stagger, fps, config: { damping: 16, mass: 0.7, stiffness: 140 } });
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingTop: "0.14em", marginTop: "-0.14em", paddingBottom: "0.14em", marginBottom: "-0.14em" }}>
                <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105 + leave * -105}%)`, ...wordStyle?.(i, w) }}>{w}</span>
                {wi < line.split(" ").length - 1 ? <span style={{ display: "inline-block", width: "0.26em" }} /> : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Text typed out at `cps` characters per second from `at`, with a blinking caret. */
export const TypeOn: React.FC<{ at: number; text: string; cps?: number; caret?: boolean; caretColor?: string; style?: React.CSSProperties; until?: number }> = ({ at, text, cps = 38, caret = true, caretColor, style, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.min(text.length, Math.floor(((frame - at) / fps) * cps)));
  const done = n >= text.length;
  const blink = done ? Math.floor(frame / 15) % 2 === 0 : true;
  const hideCaret = until != null && frame > until;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && !hideCaret ? <span style={{ display: "inline-block", width: "0.07em", height: "0.92em", background: caretColor ?? "currentColor", verticalAlign: "-0.1em", marginLeft: "0.04em", opacity: blink && frame >= at - 10 ? 1 : 0 }} /> : null}
    </span>
  );
};

/** Characters typed out according to an explicit progress (0..1), e.g. synced to a recording. */
export const TypeProgress: React.FC<{ text: string; p: number; caret?: boolean; style?: React.CSSProperties }> = ({ text, p, caret = true, style }) => {
  const frame = useCurrentFrame();
  const n = Math.round(text.length * Math.max(0, Math.min(1, p)));
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret ? <span style={{ display: "inline-block", width: "0.07em", height: "0.92em", background: "currentColor", verticalAlign: "-0.1em", marginLeft: "0.04em", opacity: n < text.length || Math.floor(frame / 15) % 2 === 0 ? 1 : 0 }} /> : null}
    </span>
  );
};

/** A rubber stamp that lands with a thump. */
export const Stamp: React.FC<{ at: number; children: React.ReactNode; color?: string; rotate?: number; size?: number; style?: React.CSSProperties }> = ({ at, children, color = C.tomatoDeep, rotate = -8, size = 44, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const o = interpolate(frame, [at, at + 3], [0, 1], clamp);
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.22}px ${size * 0.5}px ${size * 0.26}px`,
        border: `${Math.max(3, size * 0.09)}px solid ${color}`,
        borderRadius: size * 0.22,
        color,
        fontFamily: FONT.display,
        fontWeight: 800,
        fontStretch: "118%",
        fontSize: size,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        lineHeight: 1,
        opacity: o * 0.94,
        transform: `rotate(${rotate}deg) scale(${1.5 - 0.5 * p})`,
        mixBlendMode: "multiply",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A chip/label in Archivo (never mono). */
export const Chip: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; style?: React.CSSProperties; dot?: string }> = ({ children, bg = C.c0, color = C.c900, size = 24, style, dot }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, padding: `${size * 0.42}px ${size * 0.8}px ${size * 0.46}px`, borderRadius: 999, background: bg, color, fontFamily: FONT.text, fontWeight: 600, fontStretch: "106%", fontSize: size, lineHeight: 1, whiteSpace: "nowrap", ...style }}>
    {dot ? <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: "50%", background: dot, boxShadow: `0 0 0 ${size * 0.18}px ${dot}33` }} /> : null}
    {children}
  </div>
);

/** Ease a 0..1 value in over [a, b] frames. */
export const useIn = (a: number, b: number, ease: (t: number) => number = EASE.out) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });
};
