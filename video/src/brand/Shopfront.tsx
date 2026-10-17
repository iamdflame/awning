import React from "react";
import { interpolate } from "remotion";
import { C, EASE, FONT } from "./tokens";

export type ShopLook = { name: string; disp: string; dw?: number; fs: number; wall: string; trim: string; sA: string; sB: string; glass: string; art: string; w: number; h: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * One shopfront on the street (landing .shop): cornice, painted signboard, a scalloped awning in
 * the shop's own colors, a window with its poster object, and an arched door. `unroll` (0..1) drops
 * the awning; `paint` (0..1) letters the signboard left to right; `lit` warms the window.
 */
export const Shopfront: React.FC<{ s: ShopLook; unroll?: number; paint?: number; lit?: number; style?: React.CSSProperties }> = ({ s, unroll = 1, paint = 1, lit = 1, style }) => {
  const sw = 22;
  const mask = `linear-gradient(#000 0 0) top/100% calc(100% - 10px) no-repeat, radial-gradient(circle at 50% 0, #000 10.5px, #0000 11px) bottom left/${sw}px 11px repeat-x`;
  return (
    <div style={{ position: "relative", flex: "none", width: s.w, height: s.h, background: s.wall, display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "4px 4px 0 0", ...style }}>
      <span style={{ position: "absolute", top: -10, left: -6, right: -6, height: 14, background: s.trim, borderRadius: 3 }} />
      <span
        style={{
          marginTop: 24,
          padding: "6px 14px 8px",
          background: s.trim,
          color: s.wall,
          fontFamily: `"${s.disp}"`,
          fontWeight: s.dw ?? 400,
          fontSize: s.fs,
          lineHeight: 1,
          whiteSpace: "nowrap",
          borderRadius: 3,
          clipPath: `inset(0 ${(1 - paint) * 100}% 0 0)`,
        }}
      >
        {s.name}
      </span>
      <span
        style={{
          position: "relative",
          width: "calc(100% + 16px)",
          height: 46,
          marginTop: 16,
          flex: "none",
          background: `linear-gradient(180deg, rgba(0,0,0,.18), transparent 45%), repeating-linear-gradient(90deg, ${s.sA} 0 ${sw}px, ${s.sB} ${sw}px ${sw * 2}px)`,
          WebkitMask: mask,
          mask,
          transformOrigin: "top",
          transform: `scaleY(${Math.max(0.04, unroll)})`,
        }}
      />
      <span style={{ flex: 1, width: "100%", display: "flex", gap: 12, padding: "10px 14px 0", alignItems: "flex-end", minHeight: 0 }}>
        <span
          style={{
            flex: 1,
            height: "calc(100% - 8px)",
            background: `linear-gradient(160deg, rgba(255,255,255,.3), rgba(255,255,255,0) 40%), ${s.glass}`,
            border: `5px solid ${s.trim}`,
            borderBottomWidth: 9,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <span style={{ width: "84%", marginBottom: "-4%", display: "block", opacity: 0.35 + 0.65 * lit }} dangerouslySetInnerHTML={{ __html: s.art.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ') }} />
          <span style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 100%, rgba(255,214,120,${0.22 * lit}), transparent 70%)`, mixBlendMode: "screen" }} />
        </span>
        <span style={{ width: 56, height: "calc(100% - 8px)", background: s.trim, borderRadius: "28px 28px 0 0", position: "relative", flex: "none" }}>
          <span style={{ position: "absolute", inset: "10px 10px 30% 10px", borderRadius: "20px 20px 4px 4px", background: s.glass }} />
        </span>
      </span>
    </div>
  );
};

/** The curb under a street. */
export const Curb: React.FC<{ width: number | string; height?: number }> = ({ width, height = 64 }) => (
  <div style={{ position: "relative", width, height, background: `linear-gradient(${C.c300} 0 10px, ${C.c200} 10px)` }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 34, height: 4, background: `repeating-linear-gradient(90deg, ${C.c50} 0 60px, transparent 60px 120px)`, opacity: 0.8 }} />
  </div>
);

/** A small "+5.00" chip that pops above a shop when an agent buys there. */
export const SaleChip: React.FC<{ p: number; amount?: string; style?: React.CSSProperties }> = ({ p, amount = "+5.00", style }) => (
  <div
    style={{
      position: "absolute",
      padding: "8px 14px 9px",
      background: C.c0,
      borderRadius: 999,
      boxShadow: "0 10px 24px rgba(0,30,18,.25)",
      fontFamily: FONT.display,
      fontWeight: 800,
      fontStretch: "112%",
      fontSize: 26,
      color: C.g600,
      letterSpacing: "-0.02em",
      whiteSpace: "nowrap",
      opacity: interpolate(p, [0, 0.15, 0.8, 1], [0, 1, 1, 0], clamp),
      transform: `translateY(${interpolate(p, [0, 0.25, 1], [16, 0, -30], { ...clamp, easing: EASE.out })}px) scale(${interpolate(p, [0, 0.2], [0.8, 1], clamp)})`,
      ...style,
    }}
  >
    {amount}
  </div>
);
