import type { Palette } from "../db/schema";
import { ART, artKindFor, coffee, type ArtKind, type ArtPalette } from "./art";
import { EXTRA, SAMPLES, type ExtraShop, type SampleBusiness } from "./samples";
import { structureFor, themeFrom } from "./theme";

/**
 * The "Opened today" street (landing.js renderStreet): real businesses first,
 * then the design's sample shops, always marked as examples and never with
 * sales. Pure, so the server render and the client poll build identical shops.
 */
export type ShopView = {
  key: string;
  name: string;
  href: string | null;
  example: boolean;
  disp: string;
  dw: number;
  fs: number;
  w: number;
  h: number;
  wall: string;
  trim: string;
  sA: string;
  sB: string;
  glass: string;
  art: string;
  uid: string;
  tagTitle: string;
  tagLine: string;
};

/** What the street needs to know about a real business (all from the public API). */
export type RealShop = {
  slug: string;
  name: string;
  category: string;
  city: string | null;
  url: string;
  tagline: string;
  palette: Palette;
  offers: { title: string; priceUsd: number }[];
  openedAt: string | null;
  lastSaleUsd: number | null;
};

export const STREET_LENGTH = 7;
const SIZES: [number, number][] = [
  [310, 350],
  [300, 320],
  [290, 330],
  [260, 360],
  [280, 300],
  [300, 360],
  [250, 340],
];
// average glyph width (em) of each signboard face, for fitting long names
const WIDTH: Record<string, number> = { "Alfa Slab One": 0.62, "Big Shoulders Display": 0.42, "Young Serif": 0.56, Shrikhand: 0.62, "Rubik Mono One": 0.86, Gloock: 0.55, "Bagel Fat One": 0.62 };

function fit(name: string, font: string, base: number, w: number): number {
  const room = w - 44;
  return Math.max(15, Math.min(base, Math.floor(room / (Math.max(4, [...name].length) * (WIDTH[font] ?? 0.6)))));
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Opened today" / "Opened Oct 15" (UTC, so server and browser agree). */
export function openedLabel(openedAt: string | null, now: Date): string {
  if (!openedAt) return "Open now";
  const d = new Date(openedAt);
  if (Number.isNaN(d.getTime())) return "Open now";
  if (now.getTime() - d.getTime() < 24 * 3600_000) return "Opened today";
  return `Opened ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function openedToday(openedAt: string | null, now: Date): boolean {
  return !!openedAt && now.getTime() - new Date(openedAt).getTime() < 24 * 3600_000;
}

function artFor(kind: ArtKind, p: ArtPalette, name: string, uid: string, city: string | null): string {
  if (kind === "coffee") return coffee(p, name, uid, { big: (name.trim()[0] ?? "A").toUpperCase(), small: (city ?? "small batch").toUpperCase().slice(0, 18) });
  return ART[kind](p, name, uid);
}

export function shopFromReal(r: RealShop, i: number, now: Date): ShopView {
  const s = structureFor({ category: r.category, name: r.name, tagline: r.tagline, offers: r.offers });
  const t = themeFrom(r.palette, s.hero);
  const [w, h] = SIZES[i % SIZES.length]!;
  const uid = `st-${r.slug}`;
  const base = s.hero === "poster" ? 34 : 30;
  const kind = artKindFor([r.category, r.name, r.tagline, ...r.offers.map((o) => o.title)].join(" "));
  return {
    key: `real:${r.slug}`,
    name: r.name,
    href: r.url,
    example: false,
    disp: s.display,
    dw: s.hero === "poster" ? 900 : 400,
    fs: fit(r.name, s.display, base, w),
    w,
    h,
    wall: t.ground,
    trim: t.ink,
    sA: t.stripeA,
    sB: t.stripeB,
    glass: t.deep,
    art: artFor(kind, { ...t, displayFont: s.display, textFont: s.text }, r.name, uid, r.city),
    uid,
    tagTitle: r.city ? `${r.name}, ${r.city}` : r.name,
    tagLine: r.lastSaleUsd != null ? `Last sale: ${money(r.lastSaleUsd)}` : openedLabel(r.openedAt, now),
  };
}

export function shopFromSample(b: SampleBusiness, i: number): ShopView {
  const [w, h] = SIZES[i % SIZES.length]!;
  const uid = `ex-${b.slug}`;
  const base = b.hero === "poster" ? 34 : 30;
  return {
    key: `example:${b.slug}`,
    name: b.name,
    href: null,
    example: true,
    disp: b.fonts.display,
    dw: b.hero === "poster" ? 900 : 400,
    fs: fit(b.name, b.fonts.display, base, w),
    w,
    h,
    wall: b.palette.ground,
    trim: b.palette.ink,
    sA: b.palette.stripeA,
    sB: b.palette.stripeB,
    glass: b.palette.deep,
    art: ART[b.art]({ ...b.palette, displayFont: b.fonts.display, textFont: b.fonts.text }, b.name, uid),
    uid,
    tagTitle: `Example: ${b.name}`,
    tagLine: `What a ${b.category.toLowerCase()} gets`,
  };
}

export function shopFromExtra(e: ExtraShop, uidPrefix = "ex"): ShopView {
  const uid = `${uidPrefix}-${e.slug}`;
  return {
    key: `example:${e.slug}`,
    name: e.name,
    href: null,
    example: true,
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
    uid,
    tagTitle: `Example: ${e.full ?? e.name}`,
    tagLine: `What ${e.kind} gets`,
  };
}

/** The design's street order, used to fill the gaps after the real shops. */
function examples(): ShopView[] {
  const [b0, b1, b2] = SAMPLES as [SampleBusiness, SampleBusiness, SampleBusiness];
  const [e0, e1, e2, e3] = EXTRA as [ExtraShop, ExtraShop, ExtraShop, ExtraShop];
  return [shopFromSample(b0, 0), shopFromExtra(e0), shopFromSample(b1, 2), shopFromExtra(e1), shopFromExtra(e2), shopFromSample(b2, 5), shopFromExtra(e3)];
}

export function buildStreet(real: RealShop[], now: Date, need = STREET_LENGTH): ShopView[] {
  const shops = real.slice(0, 12).map((r, i) => shopFromReal(r, i, now));
  if (shops.length >= need) return shops;
  // never an example with the same name as a real shop on the street
  const taken = new Set(real.map((r) => r.name.trim().toLowerCase()));
  return [...shops, ...examples().filter((e) => !taken.has(e.name.trim().toLowerCase())).slice(0, need - shops.length)];
}

/** A second copy for the endless drift, with its own SVG ids. */
export function copyForLoop(s: ShopView): ShopView {
  return { ...s, key: `${s.key}:loop`, uid: `${s.uid}-b`, art: s.art.split(s.uid).join(`${s.uid}-b`) };
}
