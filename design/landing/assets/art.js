/* Poster art for generated storefronts: one flat, graphic object per category, drawn in the
   business's own palette (ground, ink, accent, accent2). No stock photos: every business gets art
   that matches its colors on day one. Categories here: coffee, bike, ceramics. */
(function () {
  const grain = (id) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

  function coffee(p, name) {
    // a kraft bag with a crimped top, a round stamp label, and beans tumbling out
    const bean = (x, y, r, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${r}" ry="${r * 0.68}" fill="${p.deep}"/><path d="M${-r * 0.8} 0 C ${-r * 0.3} ${-r * 0.32}, ${r * 0.3} ${r * 0.32}, ${r * 0.8} 0" stroke="${p.ground}" stroke-width="${r * 0.13}" fill="none" stroke-linecap="round" opacity=".55"/></g>`;
    const beans = [[84, 452, 17, 20], [128, 488, 15, -30], [70, 512, 16, 60], [452, 500, 17, 110], [496, 468, 14, 15], [520, 516, 16, -50], [430, 540, 13, 70], [160, 540, 13, -10]]
      .map((b) => bean(...b)).join('');
    return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A bag of ${name} coffee">
<defs>${grain('gc')}<clipPath id="bagc"><path d="M168 132 L432 132 L452 520 Q452 540 432 540 L168 540 Q148 540 148 520 Z"/></clipPath></defs>
<ellipse cx="300" cy="548" rx="220" ry="22" fill="${p.ink}" opacity=".14"/>
<g>
  <path d="M168 132 L432 132 L452 520 Q452 540 432 540 L168 540 Q148 540 148 520 Z" fill="${p.accent}"/>
  <g clip-path="url(#bagc)">
    <path d="M140 300 L460 300 L460 312 L140 312 Z" fill="${p.deep}" opacity=".12"/>
    <path d="M300 132 L300 540" stroke="${p.deep}" stroke-opacity=".1" stroke-width="2"/>
    <rect x="140" y="132" width="320" height="410" filter="url(#gc)"/></g>
  <rect x="160" y="70" width="280" height="70" rx="6" fill="${p.accent2}"/>
  ${Array.from({ length: 13 }, (_, i) => `<path d="M${172 + i * 20.5} 78 v54" stroke="${p.deep}" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>`).join('')}
  <circle cx="300" cy="330" r="104" fill="${p.ground}"/>
  <circle cx="300" cy="330" r="92" fill="none" stroke="${p.ink}" stroke-width="3"/>
  <path id="arcTop" d="M 222 330 A 78 78 0 0 1 378 330" fill="none"/>
  <text font-family="${p.displayFont}" font-size="25" fill="${p.ink}" letter-spacing="2"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">${name.toUpperCase()}</textPath></text>
  <text x="300" y="352" text-anchor="middle" font-family="${p.displayFont}" font-size="58" fill="${p.accent}">250g</text>
  <text x="300" y="392" text-anchor="middle" font-family="${p.textFont}" font-weight="600" font-size="15" letter-spacing="3" fill="${p.ink}">VOLTA · WASHED</text>
</g>
${beans}
</svg>`;
  }

  function bike(p, name) {
    // a rear wheel with laced spokes, a chainring, and a wrench across the lot
    const cx = 300, cy = 300, R = 220;
    const spokes = Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2, b = a + (i % 2 ? 0.55 : -0.55);
      return `<line x1="${cx + Math.cos(b) * 26}" y1="${cy + Math.sin(b) * 26}" x2="${cx + Math.cos(a) * (R - 20)}" y2="${cy + Math.sin(a) * (R - 20)}" stroke="${p.ink}" stroke-width="2.4"/>`;
    }).join('');
    const teeth = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; return `<rect x="-5" y="-96" width="10" height="16" rx="2" fill="${p.accent}" transform="rotate(${(a * 180) / Math.PI})"/>`; }).join('');
    const knurl = Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return `<line x1="${Math.cos(a) * (R - 6)}" y1="${Math.sin(a) * (R - 6)}" x2="${Math.cos(a) * (R + 8)}" y2="${Math.sin(a) * (R + 8)}" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/>`; }).join('');
    return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A bicycle wheel and a wrench">
<g class="art-spin" style="transform-origin:300px 300px">
<g transform="translate(${cx} ${cy})">${knurl}</g>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.ink}" stroke-width="22"/>
<circle cx="${cx}" cy="${cy}" r="${R - 20}" fill="none" stroke="${p.ink}" stroke-width="6"/>
${spokes}
<g transform="translate(${cx} ${cy})"><circle r="84" fill="${p.accent}"/>${teeth}<circle r="58" fill="${p.ground}"/>
${Array.from({ length: 5 }, (_, i) => `<path d="M0 0 L${Math.cos((i / 5) * Math.PI * 2) * 70} ${Math.sin((i / 5) * Math.PI * 2) * 70}" stroke="${p.accent}" stroke-width="16" stroke-linecap="round"/>`).join('')}
<circle r="22" fill="${p.ink}"/><circle r="8" fill="${p.ground}"/></g>
</g>
<g transform="translate(300 300) rotate(-38)">
  <rect x="-260" y="-17" width="440" height="34" rx="17" fill="${p.accent2}"/>
  <path d="M180 -44 a52 52 0 1 1 0 88 l0 -26 a26 26 0 1 0 0 -36 z" fill="${p.accent2}"/>
  <rect x="-240" y="-5" width="300" height="10" rx="5" fill="${p.ink}" opacity=".18"/>
  <text x="-120" y="9" font-family="${p.textFont}" font-weight="700" font-size="20" letter-spacing="4" fill="${p.ink}" opacity=".6">15 MM</text>
</g>
</svg>`;
  }

  function ceramics(p, name) {
    // a tall vase, a stack of bowls, a cup: river-blue glaze dripping over a raw clay foot
    return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A glazed vase, bowls and a cup">
<defs>${grain('gk')}
<clipPath id="vase"><path d="M250 92 h100 q-6 40 14 70 q66 92 66 190 q0 138 -96 176 h-68 q-96 -38 -96 -176 q0 -98 66 -190 q20 -30 14 -70 z"/></clipPath>
<clipPath id="bowl1"><path d="M60 444 h220 q-8 92 -110 100 q-102 -8 -110 -100 z"/></clipPath></defs>
<ellipse cx="300" cy="552" rx="270" ry="20" fill="${p.ink}" opacity=".12"/>
<g clip-path="url(#vase)">
  <rect x="150" y="80" width="300" height="480" fill="#d9b48f"/>
  <path d="M150 80 H450 V392 q-18 0 -22 34 q-4 30 -22 30 q-18 0 -22 -44 q-6 -30 -24 -30 q-18 0 -22 52 q-4 26 -22 26 q-18 0 -22 -40 q-4 -26 -22 -26 q-18 0 -22 34 q-4 22 -22 22 q-18 0 -22 -30 V80 z" fill="${p.accent}"/>
  <path d="M150 80 H450 V210 q-150 40 -300 0 z" fill="${p.ink}" opacity=".85"/>
  <rect x="150" y="80" width="300" height="480" filter="url(#gk)"/>
  <path d="M232 170 q-40 90 -30 220" stroke="#fff" stroke-opacity=".35" stroke-width="14" fill="none" stroke-linecap="round"/>
</g>
<g clip-path="url(#bowl1)">
  <rect x="50" y="440" width="240" height="110" fill="#d9b48f"/>
  <path d="M50 440 H290 V500 q-20 0 -24 14 q-4 12 -22 12 q-18 0 -22 -22 q-4 -10 -22 -10 q-18 0 -22 24 q-4 10 -22 10 q-18 0 -22 -18 q-4 -12 -22 -12 q-20 0 -24 16 V440z" fill="${p.accent2}"/>
  <rect x="50" y="440" width="240" height="110" filter="url(#gk)"/>
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

  window.AWNING_ART = { coffee, bike, ceramics };
})();
