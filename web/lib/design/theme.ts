import type { Palette } from "../db/schema";
import { bestOn, contrast, ensureContrast, isHex, lightness, luminance, mix } from "./color";

/**
 * Storefront theming (ported from design/storefront/storefront.js): the category
 * picks a structure (fonts, hero layout, canopy) and `themeFrom` derives the full
 * theme from the API's four colors.
 */
export type HeroKind = "sign" | "poster" | "arch";
export type CanopyKind = "scallop" | "flat" | "tile";
export type Structure = { display: string; text: string; hero: HeroKind; canopy: CanopyKind };
export type Theme = { ground: string; ink: string; accent: string; accent2: string; stripeA: string; stripeB: string; deep: string; onAccent: string };

// food: menu board, scalloped canopy · repair: pegboard of price tags, flat hemmed canopy · studio: arched window, tiled lintel
export const SIGN: Structure = { display: "Alfa Slab One", text: "Work Sans", hero: "sign", canopy: "scallop" };
export const POSTER: Structure = { display: "Big Shoulders Display", text: "Barlow", hero: "poster", canopy: "flat" };
export const ARCH: Structure = { display: "Young Serif", text: "Figtree", hero: "arch", canopy: "tile" };

/** The design's rows, matched against a business's category, name, tagline and offers. */
export const BY_CATEGORY: [RegExp, Structure][] = [
  [/coffee|bakery|bake|bread|food|cafe|café|kitchen|restaurant|\bbar\b|\btea\b|cater|meal|sweets|cake/i, SIGN],
  [/\bbikes?\b|bicycle|repair|garage|auto|tools|hardware|fitness|\bgym\b|handyman|plumb|cleaning/i, POSTER],
  [/ceramic|pottery|studio|craft|\bart\b|flor|design|beauty|hair|photo/i, ARCH],
];

/** The API's category labels (web/lib/plan/catalog.ts) onto the design's rows. */
export const BY_LABEL: Record<string, Structure> = {
  "Coffee & Tea": SIGN,
  "Bakery & Sweets": SIGN,
  "Food & Catering": SIGN,
  Pets: SIGN,
  "Home Services": POSTER,
  "Fitness & Wellness": POSTER,
  "Tech & Digital": POSTER,
  "Beauty & Hair": ARCH,
  "Design & Creative": ARCH,
  Photography: ARCH,
  "Tutoring & Lessons": ARCH,
  "Consulting & Services": ARCH,
  "Shop & Handmade": ARCH,
};

/**
 * Strong words in the business's own text win (a bike shop drafted as "Home
 * Services" is still a bike shop); then the API label; then the design's rows on
 * the category text; then the design's fallback (the studio structure).
 */
export function structureFor(b: { category: string; name?: string; tagline?: string; offers?: { title: string }[] }): Structure {
  const own = [b.name ?? "", b.tagline ?? "", ...(b.offers ?? []).map((o) => o.title)].join(" ");
  if (/coffee|espresso|roast|bakery|bread|sourdough|pastr|kitchen|restaurant/i.test(own)) return SIGN;
  if (/\bbikes?\b|bicycle|cycling/i.test(own)) return POSTER;
  if (/ceramic|pottery|stoneware|\bclay\b/i.test(own)) return ARCH;
  const byLabel = BY_LABEL[b.category];
  if (byLabel) return byLabel;
  return BY_CATEGORY.find(([re]) => re.test(`${b.category} ${own}`))?.[1] ?? ARCH;
}

const FALLBACK: Palette = { primary: "#2B59C3", accent: "#F5B700", ink: "#0F1D3D", paper: "#F6F8FC" };

function sane(p: Partial<Palette> | null | undefined): Palette {
  const pal = { ...FALLBACK, ...(p ?? {}) };
  const ok = isHex(pal.primary) && isHex(pal.accent) && isHex(pal.ink) && isHex(pal.paper) && contrast(pal.ink, pal.paper) >= 4.5;
  return ok ? { primary: pal.primary, accent: pal.accent, ink: pal.ink, paper: pal.paper } : FALLBACK;
}

/** A button color whose label reads (4.5:1): moves the color away from its label until it does. */
function button(accent: string, labels: string[]): { accent: string; onAccent: string } {
  const on = bestOn(accent, labels);
  if (contrast(on, accent) >= 4.5) return { accent, onAccent: on };
  const away = luminance(on) < 0.2 ? "#ffffff" : "#000000";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const a = mix(accent, away, t);
    const o = bestOn(a, labels);
    if (contrast(o, a) >= 4.5) return { accent: a, onAccent: o };
  }
  return { accent: away, onAccent: bestOn(away, labels) };
}

/**
 * The API's palette is {primary, accent, ink, paper}; the richer theme derives
 * from it per structure, so a business generated with only four colors still
 * gets a field, stripes, a deep tone and readable text everywhere (every pair
 * is contrast-checked). The fields follow the design's three samples:
 * food sits on a dark field with light ink (Ridge Roast), repair on a saturated
 * light field (Spoke & Chain), studios on a tinted paper (Barro).
 */
export function themeFrom(palette: Partial<Palette> | null | undefined, hero: HeroKind): Theme {
  const p = sane(palette);
  const white = "#ffffff";

  if (hero === "sign") {
    // a dark field of the primary, lettered in the paper color
    let ground = p.primary;
    for (let t = 0; t <= 0.85 && contrast(p.paper, ground) < 7; t += 0.05) ground = mix(p.primary, p.ink, t);
    if (contrast(p.paper, ground) < 7) ground = ensureContrast(ground, p.paper, 7, "#000000");
    const ink = p.paper;
    const deep = mix(ground, "#000000", 0.42);
    const b = button(ensureContrast(lightness(p.accent) > lightness(ground) ? p.accent : mix(p.accent, p.paper, 0.4), deep, 3.2, p.paper), [p.ink, deep, white]);
    const accent2 = mix(b.accent, p.ink, 0.32); // a darker band of the same color (the bag's crimped top)
    return { ground, ink, accent: b.accent, accent2, stripeA: b.accent, stripeB: p.paper, deep, onAccent: b.onAccent };
  }

  if (hero === "poster") {
    // a saturated light field of the accent (or the lightest tint of it that stays readable)
    let ground = p.accent;
    for (let t = 0; t <= 0.9 && contrast(p.ink, ground) < 7; t += 0.05) ground = mix(p.accent, p.paper, t);
    if (contrast(p.ink, ground) < 7) ground = p.paper;
    const b = button(ensureContrast(p.primary, ground, 3.2, p.ink), [white, p.paper, p.ink]);
    const accent2 = contrast(p.primary, ground) > 2 ? mix(p.primary, white, 0.18) : mix(p.ink, p.primary, 0.5);
    return { ground, ink: p.ink, accent: b.accent, accent2, stripeA: b.accent, stripeB: mix(p.paper, white, 0.6), deep: mix(p.ink, p.primary, 0.25), onAccent: b.onAccent };
  }

  // arch: paper tinted with the primary, the work in a deep arched window
  const ground = ensureContrast(mix(p.paper, p.primary, 0.1), p.ink, 7, p.paper);
  const b = button(ensureContrast(p.primary, ground, 3.2, p.ink), [white, p.paper, p.ink]);
  const accent2 = p.accent;
  const deep = mix(p.ink, p.primary, 0.22);
  return { ground, ink: p.ink, accent: b.accent, accent2, stripeA: b.accent, stripeB: mix(p.paper, white, 0.6), deep, onAccent: b.onAccent };
}

/** An azulejo-style tile for studio canopies, drawn in the business's colors (storefront.js tileSVG). */
export function tileSVG(t: Theme): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="${t.stripeB}"/><path d="M24 4 44 24 24 44 4 24Z" fill="none" stroke="${t.stripeA}" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="${t.accent2}"/><path d="M0 0h10L0 10ZM48 0H38l10 10ZM0 48h10L0 38ZM48 48H38l10-10Z" fill="${t.stripeA}"/></svg>`;
}

/** Google Fonts stylesheet for a storefront (exactly the families storefront.js loads). */
export function storefrontFontsHref(s: Structure): string {
  const fam = (f: string, w?: string) => `family=${f.replace(/ /g, "+")}${w ? ":wght@" + w : ""}`;
  return `https://fonts.googleapis.com/css2?${fam(s.display, s.display === "Big Shoulders Display" ? "800;900" : "")}&${fam(s.text, "400;500;600")}&family=Martian+Mono:wght@500&family=Archivo:wdth,wght@100..125,500..700&display=swap`;
}
