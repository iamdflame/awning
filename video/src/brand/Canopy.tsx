import React from "react";
import { C } from "./tokens";

/**
 * The striped, scalloped canopy (design/landing/landing.css .canopy): stripes of `a` and `b`, each
 * stripe ending in a scallop, shaded like canvas. `progress` unrolls it from the rod (scaleY).
 */
export const Canopy: React.FC<{
  sw?: number;
  height?: number;
  a?: string;
  b?: string;
  progress?: number;
  shadow?: boolean;
  offset?: number; // shifts the stripes sideways (px)
  style?: React.CSSProperties;
}> = ({ sw = 96, height = 126, a = C.g600, b = C.c0, progress = 1, shadow = true, offset = 0, style }) => {
  const r = sw / 2;
  const mask = `linear-gradient(#000 0 0) top/100% calc(100% - ${r}px + 1px) no-repeat, radial-gradient(circle at 50% 0, #000 ${r - 0.6}px, #0000 ${r}px) ${offset}px 100%/${sw}px ${r}px repeat-x`;
  return (
    <div
      style={{
        position: "relative",
        height,
        transformOrigin: "top",
        transform: `scaleY(${Math.max(0.0001, progress)})`,
        filter: shadow ? "drop-shadow(0 14px 14px rgba(0,41,25,.18))" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 26%, rgba(255,255,255,.1) 58%, rgba(0,0,0,.08)), repeating-linear-gradient(90deg, ${a} ${offset}px ${offset + sw}px, ${b} ${offset + sw}px ${offset + sw * 2}px)`,
          WebkitMask: mask,
          mask,
        }}
      />
    </div>
  );
};

/** The rod the canopy hangs from: a green bar, with whatever sits on it (the logo, a sign). */
export const Rod: React.FC<{ height?: number; children?: React.ReactNode; style?: React.CSSProperties; color?: string }> = ({ height = 88, children, style, color = C.g800 }) => (
  <div style={{ height, background: color, display: "flex", alignItems: "center", padding: "0 72px", gap: 32, ...style }}>{children}</div>
);
