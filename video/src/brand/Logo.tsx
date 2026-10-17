import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { EASE } from "./tokens";

/** The lockup (mark + wordmark) from design/brand. */
export const Logo: React.FC<{ height: number; reversed?: boolean; ink?: boolean; style?: React.CSSProperties }> = ({ height, reversed, ink, style }) => (
  <Img src={staticFile(`brand/${reversed ? "logo-reversed" : ink ? "logo-ink" : "logo"}.svg`)} style={{ height, width: "auto", display: "block", ...style }} />
);

/** The wordmark alone. */
export const Wordmark: React.FC<{ height: number; reversed?: boolean; style?: React.CSSProperties }> = ({ height, reversed, style }) => (
  <Img src={staticFile(`brand/${reversed ? "wordmark-reversed" : "wordmark"}.svg`)} style={{ height, width: "auto", display: "block", ...style }} />
);

// design/brand/paths.json: five stripes flaring from a rod, each ending in a scallop, on a 64 grid
const STRIPES = [
  "M15.00 18L4.00 34A5.60 5.60 0 0 0 15.20 34L21.80 18Z",
  "M21.80 18L15.20 34A5.60 5.60 0 0 0 26.40 34L28.60 18Z",
  "M28.60 18L26.40 34A5.60 5.60 0 0 0 37.60 34L35.40 18Z",
  "M35.40 18L37.60 34A5.60 5.60 0 0 0 48.80 34L42.20 18Z",
  "M42.20 18L48.80 34A5.60 5.60 0 0 0 60.00 34L49.00 18Z",
];
const OUTLINE = "M15 18L4 34A5.60 5.60 0 0 0 15.20 34A5.60 5.60 0 0 0 26.40 34A5.60 5.60 0 0 0 37.60 34A5.60 5.60 0 0 0 48.80 34A5.60 5.60 0 0 0 60.00 34L49 18Z";
const ROD = "M9 11.5h46a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 1 0-5Z";

/** The mark. `t` (0..1) unrolls it: the rod first, then the canvas drops with a little bounce. */
export const Mark: React.FC<{ size: number; t?: number; green?: string; canvas?: string }> = ({ size, t = 1, green = "#00683b", canvas = "#f7f6ed" }) => {
  const rod = interpolate(t, [0, 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const drop = interpolate(t, [0.2, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.unroll });
  return (
    <svg width={size} height={size * (40 / 64)} viewBox="0 6 64 40" style={{ overflow: "visible", display: "block" }}>
      <g style={{ transformOrigin: "32px 18px", transform: `scaleY(${Math.max(0.001, drop)})` }} strokeLinejoin="round">
        {STRIPES.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? canvas : green} />
        ))}
        <path d={OUTLINE} fill="none" stroke={green} strokeWidth={3} />
      </g>
      <path d={ROD} fill={green} style={{ transformOrigin: "32px 14px", transform: `scaleX(${Math.max(0.001, rod)})` }} />
    </svg>
  );
};
