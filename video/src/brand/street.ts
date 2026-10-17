// The design's street (web/lib/design/street.ts): the sample businesses and their neighbours, each
// in its own colors and face. An illustration, the same one the landing uses; never presented as
// real shops or real sales.
import { ART } from "./art";
import { EXTRA, SAMPLES, type ExtraShop, type SampleBusiness } from "./samples";
import type { ShopLook } from "./Shopfront";

const SIZES: [number, number][] = [
  [310, 350],
  [300, 320],
  [290, 330],
  [260, 360],
  [280, 300],
  [300, 360],
  [250, 340],
];
const WIDTH: Record<string, number> = { "Alfa Slab One": 0.62, "Big Shoulders Display": 0.42, "Young Serif": 0.56, Shrikhand: 0.62, "Rubik Mono One": 0.86, Gloock: 0.55, "Bagel Fat One": 0.62 };
const fit = (name: string, font: string, base: number, w: number) => Math.max(15, Math.min(base, Math.floor((w - 44) / (Math.max(4, [...name].length) * (WIDTH[font] ?? 0.6)))));

function fromSample(b: SampleBusiness, i: number, uid: string): ShopLook {
  const [w, h] = SIZES[i % SIZES.length]!;
  return {
    name: b.name,
    disp: b.fonts.display,
    dw: b.hero === "poster" ? 900 : 400,
    fs: fit(b.name, b.fonts.display, b.hero === "poster" ? 34 : 30, w),
    w,
    h,
    wall: b.palette.ground,
    trim: b.palette.ink,
    sA: b.palette.stripeA,
    sB: b.palette.stripeB,
    glass: b.palette.deep,
    art: ART[b.art]({ ...b.palette, displayFont: b.fonts.display, textFont: b.fonts.text }, b.name, uid),
  };
}

function fromExtra(e: ExtraShop, uid: string): ShopLook {
  return {
    name: e.name,
    disp: e.disp,
    dw: 400,
    fs: e.fs,
    w: e.w,
    h: e.h,
    wall: e.wall,
    trim: e.trim,
    sA: e.sA,
    sB: e.sB,
    glass: e.glass,
    art: ART[e.art]({ ground: e.wall, ink: e.trim, accent: e.sA, accent2: e.sB, deep: e.glass, displayFont: e.disp, textFont: "Archivo" }, e.name, uid),
  };
}

/** The street in the landing's order, `copies` times over (each copy with its own SVG ids). */
export function streetLooks(copies = 2): ShopLook[] {
  const [b0, b1, b2] = SAMPLES as [SampleBusiness, SampleBusiness, SampleBusiness];
  const [e0, e1, e2, e3] = EXTRA as [ExtraShop, ExtraShop, ExtraShop, ExtraShop];
  const out: ShopLook[] = [];
  for (let c = 0; c < copies; c++) {
    const u = (s: string) => `film${c}-${s}`;
    out.push(fromSample(b0, 0, u(b0.slug)), fromExtra(e0, u(e0.slug)), fromSample(b1, 2, u(b1.slug)), fromExtra(e1, u(e1.slug)), fromExtra(e2, u(e2.slug)), fromSample(b2, 5, u(b2.slug)), fromExtra(e3, u(e3.slug)));
  }
  return out;
}
