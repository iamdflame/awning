// Generates Awning's mark, wordmark and lockup as SVG paths (no font dependency at use time).
// Usage: node brand-gen.mjs  -> writes ../brand/*.svg
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const GREEN = '#00683b';
const CANVAS = '#f7f6ed';
const INK = '#081d13';

// ---------- the mark: a front-view awning, 5 stripes, scalloped valance ----------
// Built on a 64 grid. Rod on top, canopy flares out (trapezoid), each stripe ends in a scallop.
function markPaths({ fillA = GREEN, fillB = CANVAS, stroke = GREEN, sw = 3 } = {}) {
  const n = 5;
  const topY = 18, botY = 34, topL = 15, topR = 49, botL = 4, botR = 60;
  const tw = (topR - topL) / n, bw = (botR - botL) / n;
  const r = bw / 2;
  const stripes = [];
  for (let i = 0; i < n; i++) {
    const x0t = topL + i * tw, x1t = x0t + tw;
    const x0b = botL + i * bw, x1b = x0b + bw;
    // stripe with a scallop: down the left side, arc along the bottom, up the right side
    const d = `M${x0t.toFixed(2)} ${topY}L${x0b.toFixed(2)} ${botY}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${x1b.toFixed(2)} ${botY}L${x1t.toFixed(2)} ${topY}Z`;
    stripes.push({ d, fill: i % 2 === 0 ? fillA : fillB });
  }
  // outline of the whole canopy (for stripes in the background color)
  let outline = `M${topL} ${topY}L${botL} ${botY}`;
  for (let i = 0; i < n; i++) {
    const x1b = botL + (i + 1) * bw;
    outline += `A${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${x1b.toFixed(2)} ${botY}`;
  }
  outline += `L${topR} ${topY}Z`;
  const rod = `M9 11.5h46a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 1 0-5Z`;
  return { stripes, outline, rod, stroke, sw };
}

function markSVG(opts = {}, { size = 64, bg = null, pad = 0 } = {}) {
  const m = markPaths(opts);
  const vb = `${-pad} ${-pad + 2} ${64 + pad * 2} ${64 + pad * 2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" role="img" aria-label="Awning">
${bg ? `<rect x="${-pad}" y="${-pad + 2}" width="${64 + pad * 2}" height="${64 + pad * 2}" rx="${(64 + pad * 2) * 0.22}" fill="${bg}"/>` : ''}
<g stroke-linejoin="round">
${m.stripes.map((s) => `<path d="${s.d}" fill="${s.fill}"/>`).join('\n')}
<path d="${m.outline}" fill="none" stroke="${m.stroke}" stroke-width="${m.sw}"/>
<path d="${m.rod}" fill="${m.stroke}"/>
</g></svg>`;
}

// ---------- wordmark: "awning" in Archivo Expanded ExtraBold, outlined, kerned by eye ----------
import { execFileSync } from 'node:child_process';
function wordPath(text, size, tracking = -0.02, ttf = 'Archivo-800-125.ttf') {
  const r = JSON.parse(execFileSync('python', ['word.py', ttf, text, String(size), String(tracking)]).toString());
  r.d = r.d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 100) / 100));
  return r;
}

const W = wordPath('awning', 100);
const wordW = Math.ceil(W.width);
const wordmark = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordW} 100" width="${wordW}" height="100" role="img" aria-label="Awning"><path d="${W.d}" fill="${fill}"/></svg>`;

// lockup: mark left of the word, mark height ~ cap height * 1.35
function lockup(fill, stripeB) {
  const m = markPaths({ fillA: fill, fillB: stripeB, stroke: fill });
  const s = 2.0; // mark scale: scallops sit on the baseline, rod near the x-height
  const gap = 18;
  const mw = 58 * s;
  const total = Math.ceil(mw + gap + wordW);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 100" width="${total}" height="100" role="img" aria-label="Awning">
<g transform="translate(-6 ${78 - 39.6 * s}) scale(${s})" stroke-linejoin="round">
${m.stripes.map((st) => `<path d="${st.d}" fill="${st.fill}"/>`).join('')}
<path d="${m.outline}" fill="none" stroke="${m.stroke}" stroke-width="${m.sw}"/><path d="${m.rod}" fill="${m.stroke}"/></g>
<g transform="translate(${mw + gap} 0)"><path d="${W.d}" fill="${fill}"/></g></svg>`;
}

const files = {
  'mark.svg': markSVG({}, { size: 64 }),
  'mark-reversed.svg': markSVG({ fillA: CANVAS, fillB: GREEN, stroke: CANVAS }, { size: 64 }),
  'mark-mono-ink.svg': markSVG({ fillA: INK, fillB: 'none', stroke: INK }, { size: 64 }),
  'favicon.svg': markSVG({ fillA: CANVAS, fillB: GREEN, stroke: CANVAS, sw: 3.4 }, { size: 64, bg: GREEN, pad: 4 }),
  'app-icon.svg': markSVG({ fillA: CANVAS, fillB: GREEN, stroke: CANVAS, sw: 3 }, { size: 512, bg: GREEN, pad: 14 }),
  'wordmark.svg': wordmark(GREEN),
  'wordmark-ink.svg': wordmark(INK),
  'wordmark-reversed.svg': wordmark(CANVAS),
  'logo.svg': lockup(GREEN, CANVAS),
  'logo-reversed.svg': lockup(CANVAS, GREEN),
  'logo-ink.svg': lockup(INK, 'none'),
};
for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), s);
// expose raw paths for inline use in pages
fs.writeFileSync(path.join(OUT, 'paths.json'), JSON.stringify({ mark: markPaths(), word: W.d, wordWidth: wordW }, null, 1));
console.log('wrote', Object.keys(files).join(', '), 'to', OUT);
