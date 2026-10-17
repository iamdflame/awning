// Awning tokens for the film (design/brand/palette.css; hex equivalents of the OKLCH source).
import { Easing } from "remotion";

export const C = {
  g50: "#e8fbef",
  g100: "#cdf3db",
  g200: "#a8e5c0",
  g300: "#76cd9c",
  g400: "#3baa73",
  g500: "#008450",
  g600: "#00683b", // the canopy
  g700: "#00512e",
  g800: "#003b23", // the rod
  g900: "#002919", // window frame, agents section
  g950: "#00190f", // footer, code boards
  c0: "#fcfcf7", // paper
  c50: "#f7f6ed", // canvas
  c100: "#eeeee2",
  c200: "#e0e0d1",
  c300: "#c6c9b7",
  c500: "#828e80",
  c700: "#526355", // muted ink
  c900: "#081d13", // ink
  tomato: "#eb4b35", // the OPEN sign: CTAs and live signals only
  tomatoDeep: "#cc3526",
  sun: "#faca4b", // where money lands
} as const;

export const FONT = {
  display: '"Archivo", ui-sans-serif, sans-serif',
  text: '"Archivo", ui-sans-serif, sans-serif',
  receipt: '"Martian Mono", ui-monospace, monospace',
} as const;

/** Display type: Archivo 800 at width 118%, tight tracking (design/BRAND.md). */
export const display = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: FONT.display,
  fontWeight: 800,
  fontStretch: "118%",
  fontSize: size,
  lineHeight: 0.96,
  letterSpacing: "-0.035em",
  ...extra,
});

/** Receipt type: Martian Mono at width 88, only where a printer or a machine speaks. */
export const receipt = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: FONT.receipt,
  fontStretch: "88%",
  fontSize: size,
  fontVariantNumeric: "tabular-nums",
  ...extra,
});

export const SHADOW = {
  s2: "0 1px 2px rgba(0,41,25,.06), 0 4px 8px rgba(0,41,25,.06), 0 16px 32px -8px rgba(0,41,25,.16)",
  s3: "0 2px 4px rgba(0,41,25,.06), 0 12px 24px -6px rgba(0,41,25,.14), 0 40px 80px -24px rgba(0,30,18,.32)",
  s4: "0 4px 8px rgba(0,41,25,.08), 0 24px 48px -12px rgba(0,41,25,.22), 0 80px 140px -40px rgba(0,30,18,.45)",
};

// --ease-out, --ease-in-out, --ease-unroll (the awning drop: a little bounce, like canvas settling)
export const EASE = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  unroll: Easing.bezier(0.34, 1.32, 0.64, 1),
  glide: Easing.bezier(0.83, 0, 0.17, 1),
};

export const W = 1920;
export const H = 1080;
/** Everything but captions stays above this line; the caption band sits below it. */
export const SAFE_BOTTOM = 880;
export const GUTTER = 120;
