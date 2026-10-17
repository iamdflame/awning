// Copied from web/lib/design/art.ts (the storefronts' poster art) so the film draws the same objects.
/**
 * Poster art for storefronts and the street: one flat, graphic object per kind,
 * drawn in the business's own palette (ported from design/shared/art.js). Every
 * id is suffixed with `uid` so many drawings can share one page.
 * Kinds: coffee, bike, ceramics (from the design) and goods (a paper shop bag,
 * the neutral object for every other kind of business).
 */
export type ArtPalette = { ground: string; ink: string; accent: string; accent2: string; deep: string; displayFont: string; textFont: string };
export type ArtKind = "coffee" | "bike" | "ceramics" | "goods";
export type CoffeeLabel = { big: string; small: string };

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const grain = (id: string) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

export function coffee(p: ArtPalette, name: string, uid: string, label: CoffeeLabel = { big: "250g", small: "VOLTA WASHED" }): string {
  // a kraft bag with a crimped top, a round stamp label, and beans tumbling out
  const bean = (x: number, y: number, r: number, rot: number) =>
    `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${r}" ry="${r * 0.68}" fill="${p.deep}"/><path d="M${-r * 0.8} 0 C ${-r * 0.3} ${-r * 0.32}, ${r * 0.3} ${r * 0.32}, ${r * 0.8} 0" stroke="${p.ground}" stroke-width="${r * 0.13}" fill="none" stroke-linecap="round" opacity=".55"/></g>`;
  const beans = (
    [
      [84, 452, 17, 20],
      [128, 488, 15, -30],
      [70, 512, 16, 60],
      [452, 500, 17, 110],
      [496, 468, 14, 15],
      [520, 516, 16, -50],
      [430, 540, 13, 70],
      [160, 540, 13, -10],
    ] as const
  )
    .map(([x, y, r, rot]) => bean(x, y, r, rot))
    .join("");
  const big = esc(label.big);
  const bigSize = label.big.length <= 2 ? 84 : label.big.length <= 4 ? 58 : 44;
  return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A bag of ${esc(name)} coffee">
<defs>${grain(`gc-${uid}`)}<clipPath id="bagc-${uid}"><path d="M168 132 L432 132 L452 520 Q452 540 432 540 L168 540 Q148 540 148 520 Z"/></clipPath></defs>
<ellipse cx="300" cy="548" rx="220" ry="22" fill="${p.ink}" opacity=".14"/>
<g>
  <path d="M168 132 L432 132 L452 520 Q452 540 432 540 L168 540 Q148 540 148 520 Z" fill="${p.accent}"/>
  <g clip-path="url(#bagc-${uid})">
    <path d="M140 300 L460 300 L460 312 L140 312 Z" fill="${p.deep}" opacity=".12"/>
    <path d="M300 132 L300 540" stroke="${p.deep}" stroke-opacity=".1" stroke-width="2"/>
    <rect x="140" y="132" width="320" height="410" filter="url(#gc-${uid})"/></g>
  <rect x="160" y="70" width="280" height="70" rx="6" fill="${p.accent2}"/>
  ${Array.from({ length: 13 }, (_, i) => `<path d="M${172 + i * 20.5} 78 v54" stroke="${p.deep}" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>`).join("")}
  <circle cx="300" cy="330" r="104" fill="${p.ground}"/>
  <circle cx="300" cy="330" r="92" fill="none" stroke="${p.ink}" stroke-width="3"/>
  <path id="arcTop-${uid}" d="M 222 330 A 78 78 0 0 1 378 330" fill="none"/>
  <text font-family="${esc(p.displayFont)}" font-size="25" fill="${p.ink}" letter-spacing="2"><textPath href="#arcTop-${uid}" startOffset="50%" text-anchor="middle">${esc(name.toUpperCase())}</textPath></text>
  <text x="300" y="${bigSize > 60 ? 362 : 352}" text-anchor="middle" font-family="${esc(p.displayFont)}" font-size="${bigSize}" fill="${p.accent}">${big}</text>
  <text x="300" y="392" text-anchor="middle" font-family="${esc(p.textFont)}" font-weight="600" font-size="13" letter-spacing="2.5" fill="${p.ink}">${esc(label.small)}</text>
</g>
${beans}
</svg>`;
}

export function bike(p: ArtPalette, _name: string, _uid: string): string {
  // a rear wheel with laced spokes, a chainring, and a wrench across the lot
  const cx = 300,
    cy = 300,
    R = 220;
  const spokes = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2,
      b = a + (i % 2 ? 0.55 : -0.55);
    return `<line x1="${r2(cx + Math.cos(b) * 26)}" y1="${r2(cy + Math.sin(b) * 26)}" x2="${r2(cx + Math.cos(a) * (R - 20))}" y2="${r2(cy + Math.sin(a) * (R - 20))}" stroke="${p.ink}" stroke-width="2.4"/>`;
  }).join("");
  const teeth = Array.from({ length: 36 }, (_, i) => `<rect x="-5" y="-96" width="10" height="16" rx="2" fill="${p.accent}" transform="rotate(${r2(i * 10)})"/>`).join("");
  const knurl = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return `<line x1="${r2(Math.cos(a) * (R - 6))}" y1="${r2(Math.sin(a) * (R - 6))}" x2="${r2(Math.cos(a) * (R + 8))}" y2="${r2(Math.sin(a) * (R + 8))}" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/>`;
  }).join("");
  return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A bicycle wheel and a wrench">
<g class="art-spin" style="transform-origin:300px 300px">
<g transform="translate(${cx} ${cy})">${knurl}</g>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.ink}" stroke-width="22"/>
<circle cx="${cx}" cy="${cy}" r="${R - 20}" fill="none" stroke="${p.ink}" stroke-width="6"/>
${spokes}
<g transform="translate(${cx} ${cy})"><circle r="84" fill="${p.accent}"/>${teeth}<circle r="58" fill="${p.ground}"/>
${Array.from({ length: 5 }, (_, i) => `<path d="M0 0 L${r2(Math.cos((i / 5) * Math.PI * 2) * 70)} ${r2(Math.sin((i / 5) * Math.PI * 2) * 70)}" stroke="${p.accent}" stroke-width="16" stroke-linecap="round"/>`).join("")}
<circle r="22" fill="${p.ink}"/><circle r="8" fill="${p.ground}"/></g>
</g>
<g transform="translate(300 300) rotate(-38)">
  <rect x="-260" y="-17" width="440" height="34" rx="17" fill="${p.accent2}"/>
  <path d="M180 -44 a52 52 0 1 1 0 88 l0 -26 a26 26 0 1 0 0 -36 z" fill="${p.accent2}"/>
  <rect x="-240" y="-5" width="300" height="10" rx="5" fill="${p.ink}" opacity=".18"/>
  <text x="-120" y="9" font-family="${esc(p.textFont)}" font-weight="700" font-size="20" letter-spacing="4" fill="${p.ink}" opacity=".6">15 MM</text>
</g>
</svg>`;
}

export function ceramics(p: ArtPalette, _name: string, uid: string): string {
  // a tall vase, a stack of bowls, a cup: glaze dripping over a raw clay foot
  return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A glazed vase, bowls and a cup">
<defs>${grain(`gk-${uid}`)}
<clipPath id="vase-${uid}"><path d="M250 92 h100 q-6 40 14 70 q66 92 66 190 q0 138 -96 176 h-68 q-96 -38 -96 -176 q0 -98 66 -190 q20 -30 14 -70 z"/></clipPath>
<clipPath id="bowl1-${uid}"><path d="M60 444 h220 q-8 92 -110 100 q-102 -8 -110 -100 z"/></clipPath></defs>
<ellipse cx="300" cy="552" rx="270" ry="20" fill="${p.ink}" opacity=".12"/>
<g clip-path="url(#vase-${uid})">
  <rect x="150" y="80" width="300" height="480" fill="#d9b48f"/>
  <path d="M150 80 H450 V392 q-18 0 -22 34 q-4 30 -22 30 q-18 0 -22 -44 q-6 -30 -24 -30 q-18 0 -22 52 q-4 26 -22 26 q-18 0 -22 -40 q-4 -26 -22 -26 q-18 0 -22 34 q-4 22 -22 22 q-18 0 -22 -30 V80 z" fill="${p.accent}"/>
  <path d="M150 80 H450 V210 q-150 40 -300 0 z" fill="${p.ink}" opacity=".85"/>
  <rect x="150" y="80" width="300" height="480" filter="url(#gk-${uid})"/>
  <path d="M232 170 q-40 90 -30 220" stroke="#fff" stroke-opacity=".35" stroke-width="14" fill="none" stroke-linecap="round"/>
</g>
<g clip-path="url(#bowl1-${uid})">
  <rect x="50" y="440" width="240" height="110" fill="#d9b48f"/>
  <path d="M50 440 H290 V500 q-20 0 -24 14 q-4 12 -22 12 q-18 0 -22 -22 q-4 -10 -22 -10 q-18 0 -22 24 q-4 10 -22 10 q-18 0 -22 -18 q-4 -12 -22 -12 q-20 0 -24 16 V440z" fill="${p.accent2}"/>
  <rect x="50" y="440" width="240" height="110" filter="url(#gk-${uid})"/>
</g>
<ellipse cx="170" cy="444" rx="110" ry="14" fill="${p.deep}"/>
<path d="M78 418 h184 q-8 30 -92 30 q-84 0 -92 -30z" fill="${p.ink}"/>
<ellipse cx="170" cy="418" rx="92" ry="11" fill="${p.deep}"/>
<g transform="translate(470 420)">
  <path d="M-58 0 h116 q-4 108 -58 118 q-54 -10 -58 -118z" fill="${p.accent}"/>
  <path d="M56 26 q42 4 34 40 q-6 26 -42 28" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round"/>
  <ellipse cx="0" cy="0" rx="58" ry="10" fill="${p.deep}"/>
</g>
</svg>`;
}

export function goods(p: ArtPalette, name: string, uid: string): string {
  // a paper shop bag with rope handles, tissue peeking out and a round sticker with the shop's initial
  const initial = esc((name.trim()[0] ?? "A").toUpperCase());
  return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A ${esc(name)} shopping bag">
<defs>${grain(`gg-${uid}`)}<clipPath id="bag-${uid}"><path d="M150 214 H450 L468 528 Q468 546 450 546 H150 Q132 546 132 528 Z"/></clipPath></defs>
<ellipse cx="300" cy="552" rx="230" ry="22" fill="${p.ink}" opacity=".14"/>
<path d="M300 214 C 300 120, 392 108, 392 214" fill="none" stroke="${p.deep}" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"/>
<path d="M196 214 L232 150 L262 214 Z" fill="${p.ground}"/>
<path d="M248 214 L300 132 L344 214 Z" fill="${p.accent2}"/>
<path d="M330 214 L372 160 L404 214 Z" fill="${p.ground}" opacity=".9"/>
<g clip-path="url(#bag-${uid})">
  <path d="M150 214 H450 L468 528 Q468 546 450 546 H150 Q132 546 132 528 Z" fill="${p.accent}"/>
  <rect x="120" y="214" width="360" height="40" fill="${p.deep}" opacity=".16"/>
  <path d="M428 214 L470 546 H500 V214 Z" fill="${p.deep}" opacity=".12"/>
  <rect x="120" y="200" width="360" height="360" filter="url(#gg-${uid})"/>
</g>
<path d="M208 226 C 208 118, 300 106, 300 226" fill="none" stroke="${p.ink}" stroke-width="11" stroke-linecap="round"/>
<circle cx="208" cy="228" r="9" fill="${p.ink}"/><circle cx="300" cy="228" r="9" fill="${p.ink}"/>
<circle cx="300" cy="392" r="98" fill="${p.ground}"/>
<circle cx="300" cy="392" r="86" fill="none" stroke="${p.ink}" stroke-width="3"/>
<text x="300" y="${392 + 38}" text-anchor="middle" font-family="${esc(p.displayFont)}" font-size="112" fill="${p.accent}">${initial}</text>
</svg>`;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const ART: Record<ArtKind, (p: ArtPalette, name: string, uid: string) => string> = { coffee, bike, ceramics, goods };

/** Which object a business gets: the strongest word in its category, name, tagline or offers. */
export function artKindFor(text: string): ArtKind {
  if (/coffee|espresso|roast|caf[eé]|\btea\b|matcha/i.test(text)) return "coffee";
  if (/\bbikes?\b|bicycle|cycling|\bcycle\b/i.test(text)) return "bike";
  if (/ceramic|pottery|potter|\bclay\b|stoneware|porcelain|\bvases?\b|kiln/i.test(text)) return "ceramics";
  return "goods";
}
