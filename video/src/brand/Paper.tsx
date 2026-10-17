import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT, SHADOW, receipt } from "./tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ReceiptLine = { l: string; r?: string; at: number; tone?: "agent" | "muted" | "strong" | "green"; rule?: boolean };

/**
 * A thermal receipt (landing .receipt, /live .lv-paper): Martian Mono lines with dotted leaders,
 * each printing at its frame; a dashed rule and the amount in Archivo 800 green. Anchored at the
 * top, so new lines feed the paper out of the printer slot above it.
 */
export const Receipt: React.FC<{
  width?: number;
  head?: [string, string];
  lines: ReceiptLine[];
  total?: { amount: string; label?: React.ReactNode; at: number; color?: string };
  size?: number;
  rotate?: number;
  slot?: boolean;
  style?: React.CSSProperties;
}> = ({ width = 560, head, lines, total, size = 22, rotate = 0, slot = true, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lh = Math.round(size * 1.7);
  const tear = Math.round(size * 0.55);
  const mask = `radial-gradient(circle at ${tear}px 100%, #0000 ${tear - 1}px, #000 ${tear}px) bottom left/${tear * 2}px ${tear + 2}px repeat-x, linear-gradient(#000 0 0) top/100% calc(100% - ${tear}px) no-repeat`;
  const pop = total ? spring({ frame: frame - total.at, fps, config: { damping: 11, mass: 0.6, stiffness: 160 } }) : 0;
  return (
    <div style={{ position: "relative", width, transform: `rotate(${rotate}deg)`, transformOrigin: "top center", ...style }}>
      {slot ? <div style={{ position: "absolute", left: -18, right: -18, top: -14, height: 30, borderRadius: 15, background: C.g800, boxShadow: `inset 0 -4px 0 ${C.g900}`, zIndex: 2 }} /> : null}
      <div style={{ filter: `drop-shadow(0 18px 24px rgba(0,30,18,.22)) drop-shadow(0 2px 3px rgba(0,30,18,.12))` }}>
        <div
          style={{
            background: C.c0,
            color: C.g900,
            padding: `${size * 1.5}px ${size * 1.5}px ${size * 2.1}px`,
            WebkitMask: mask,
            mask,
            ...receipt(size, { lineHeight: 1.6 }),
          }}
        >
          {head ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, letterSpacing: "0.06em", marginBottom: size * 0.5, fontSize: size * 0.95 }}>
              <span>{head[0]}</span>
              <span>{head[1]}</span>
            </div>
          ) : null}
          {lines.map((ln, i) => {
            const p = interpolate(frame, [ln.at, ln.at + 9], [0, 1], { ...clamp, easing: EASE.out });
            const color = ln.tone === "agent" ? C.tomatoDeep : ln.tone === "muted" ? C.c700 : ln.tone === "green" ? C.g600 : C.g900;
            return (
              <div key={i} style={{ height: lh * p, opacity: p, overflow: "hidden" }}>
                {ln.rule ? (
                  <div style={{ borderTop: `2px dashed rgba(0,41,25,.3)`, marginTop: lh / 2 }} />
                ) : (
                  <div style={{ display: "flex", gap: size * 0.4, alignItems: "baseline", height: lh, color, fontWeight: ln.tone === "agent" || ln.tone === "strong" ? 700 : 400, transform: `translateY(${(1 - p) * -6}px)` }}>
                    <span style={{ whiteSpace: "nowrap" }}>{ln.l}</span>
                    {ln.r != null ? (
                      <>
                        <span style={{ flex: 1, borderBottom: `2px dotted rgba(0,41,25,.35)`, transform: `translateY(-${size * 0.3}px)` }} />
                        <span style={{ whiteSpace: "nowrap" }}>{ln.r}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
          {total ? (
            <div
              style={{
                marginTop: size * 0.5,
                paddingTop: size * 0.7,
                borderTop: `2px dashed rgba(0,41,25,.32)`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                opacity: interpolate(frame, [total.at - 6, total.at], [0, 1], clamp),
              }}
            >
              <span style={{ fontSize: size * 0.72, lineHeight: 1.35, color: C.c700, letterSpacing: "0.02em" }}>{total.label}</span>
              <b
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  fontStretch: "112%",
                  fontSize: size * 2.9,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: total.color ?? C.g600,
                  transform: `translateY(${(1 - pop) * 14}px) scale(${0.86 + pop * 0.14})`,
                  transformOrigin: "right bottom",
                  display: "inline-block",
                  opacity: Math.min(1, pop * 1.4),
                }}
              >
                {total.amount}
              </b>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** A sun ticket with notched sides (landing .ticket): orders and proposals. */
export const Ticket: React.FC<{ width?: number; kicker?: [string, string]; title: React.ReactNode; by?: React.ReactNode; amount?: React.ReactNode; note?: React.ReactNode; color?: string; rotate?: number; style?: React.CSSProperties; scale?: number }> = ({
  width = 470,
  kicker,
  title,
  by,
  amount,
  note,
  color = C.sun,
  rotate = -2.5,
  style,
  scale = 1,
}) => {
  const n = 18 * scale;
  const mask = `radial-gradient(circle at 0 62%, #0000 ${n}px, #000 ${n + 0.6}px) left/51% 100% no-repeat, radial-gradient(circle at 100% 62%, #0000 ${n}px, #000 ${n + 0.6}px) right/51% 100% no-repeat`;
  return (
    <div style={{ width, transform: `rotate(${rotate}deg)`, filter: `drop-shadow(0 20px 26px rgba(0,30,18,.28))`, ...style }}>
      <div style={{ background: color, color: C.g900, borderRadius: 22 * scale, padding: `${28 * scale}px ${32 * scale}px`, WebkitMask: mask, mask }}>
        {kicker ? (
          <div style={{ display: "flex", justifyContent: "space-between", ...receipt(18 * scale, { fontStretch: "90%", fontWeight: 600 }) }}>
            <span>{kicker[0]}</span>
            <span>{kicker[1]}</span>
          </div>
        ) : null}
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 36 * scale, lineHeight: 1.08, letterSpacing: "-0.02em", margin: `${16 * scale}px 0 ${6 * scale}px` }}>{title}</div>
        {by ? <div style={{ fontFamily: FONT.text, fontSize: 21 * scale, marginBottom: 26 * scale }}>{by}</div> : null}
        {amount ? (
          <div style={{ borderTop: `3px dashed rgba(0,41,25,.35)`, paddingTop: 18 * scale, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 54 * scale, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{amount}</b>
            <span style={{ ...receipt(16 * scale, { fontWeight: 500, textAlign: "right", lineHeight: 1.35 }) }}>{note}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** A paper price tag on a string (landing .tag), swinging in on a spring and settling. */
export const HangingTag: React.FC<{ at: number; children: React.ReactNode; width?: number; string?: number; tilt?: number; color?: string; ink?: string; style?: React.CSSProperties }> = ({
  at,
  children,
  width = 380,
  string = 150,
  tilt = -2,
  color = C.c0,
  ink = C.c900,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - at, fps, config: { damping: 13, mass: 0.9, stiffness: 120 } });
  const t = Math.max(0, frame - at) / fps;
  const swing = tilt + 7 * Math.exp(-t * 2.4) * Math.sin(t * 7.5);
  const notch = 64;
  return (
    <div style={{ position: "relative", width, transform: `translateY(${(1 - drop) * -(string + 260)}px) rotate(${swing}deg)`, transformOrigin: `50% ${-string}px`, ...style }}>
      <div style={{ position: "absolute", left: "50%", top: -string, width: 3, height: string + 40, marginLeft: -1.5, background: C.c500, borderRadius: 2 }} />
      <div
        style={{
          position: "relative",
          background: color,
          color: ink,
          borderRadius: "16px 16px 26px 26px",
          padding: `${notch + 22}px 34px 34px`,
          clipPath: `polygon(20% 0, 80% 0, 100% ${notch}px, 100% 100%, 0 100%, 0 ${notch}px)`,
          boxShadow: SHADOW.s3,
          textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 30, width: 24, height: 24, marginLeft: -12, borderRadius: "50%", background: "rgba(0,41,25,.16)", boxShadow: "inset 0 2px 3px rgba(0,41,25,.35)" }} />
        {children}
      </div>
    </div>
  );
};

/** The OPEN sign on its chain (landing .sign): flips from CLOSED to OPEN at `at`, swaying. */
export const OpenSign: React.FC<{ at: number; width?: number; style?: React.CSSProperties; chain?: string }> = ({ at, width = 220, style, chain = C.c0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flip = spring({ frame: frame - at, fps, config: { damping: 10, mass: 0.7, stiffness: 110 } });
  const t = frame / fps;
  const sway = 2.2 * Math.sin(t * 1.25);
  const h = width * 0.36;
  const face = (open: boolean): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontFamily: FONT.display,
    fontWeight: 800,
    fontStretch: "120%",
    letterSpacing: "0.06em",
    fontSize: width * 0.16,
    backfaceVisibility: "hidden",
    boxShadow: "0 8px 22px rgba(0,0,0,.3)",
    background: open ? C.tomato : C.c0,
    color: open ? "#fff" : C.g800,
    transform: `rotateY(${open ? 180 - flip * 180 : -flip * 180}deg)`,
    textShadow: open ? "0 0 18px rgba(255,190,170,.6)" : undefined,
  });
  return (
    <div style={{ width, transformOrigin: "50% 0", transform: `rotate(${sway}deg)`, ...style }}>
      <svg viewBox="0 0 62 40" style={{ display: "block", width: width * 0.52, height: width * 0.34, margin: "0 auto", color: chain }}>
        <path d="M10 40 31 4l21 36" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="31" cy="4" r="3.5" fill="currentColor" />
      </svg>
      <div style={{ position: "relative", height: h, perspective: 900 }}>
        <div style={face(false)}>CLOSED</div>
        <div style={face(true)}>OPEN</div>
      </div>
    </div>
  );
};
