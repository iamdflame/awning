// Renders every Mermaid block in web/content/ to a static, brand-themed SVG in web/public/diagrams/<hash>.svg,
// so the docs pages show real diagrams with no client-side library. The web renderer looks the SVG up by the
// same hash and falls back to the readable source when a diagram changed and was not re-rendered.
//   node diagrams.mjs        (run after scripts/sync-content.mjs whenever a diagram in docs/ changes)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const here = import.meta.dirname;
const root = path.resolve(here, '../..');
const content = path.join(root, 'web', 'content');
const outDir = path.join(root, 'web', 'public', 'diagrams');

/** Must match diagramKey() in web/lib/docs/render.ts. */
const key = (src) => createHash('sha256').update(src.replace(/\r\n/g, '\n').replace(/\s+$/, '')).digest('hex').slice(0, 12);

const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
const blocks = new Map();
for (const f of files(content)) {
  const md = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const m of md.matchAll(/^```mermaid\n([\s\S]*?)\n```/gm)) blocks.set(key(m[1]), m[1]);
}

// Awning palette (hex for mermaid's color math); see design/brand/palette.css.
const C = { c0: '#fcfcf7', c50: '#f7f6ed', c100: '#eeeee2', c200: '#e0e0d1', c300: '#c6c9b7', c500: '#828e80', c700: '#526355', ink: '#081d13', g50: '#e8fbef', g100: '#cdf3db', g600: '#00683b', g700: '#00512e', g800: '#003b23' };
const config = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  htmlLabels: true,
  fontFamily: 'Archivo',
  flowchart: { htmlLabels: true, curve: 'basis', padding: 12, nodeSpacing: 22, rankSpacing: 40, wrappingWidth: 130 },
  sequence: { useMaxWidth: true, mirrorActors: false, wrap: true, width: 128, actorMargin: 24, messageMargin: 30, messageFontSize: 14, actorFontSize: 14, noteFontSize: 13, boxMargin: 8, noteMargin: 8 },
  state: { useMaxWidth: true, nodeSpacing: 60, rankSpacing: 70 },
  er: { useMaxWidth: true },
  themeVariables: {
    fontFamily: 'Archivo', fontSize: '15px', background: C.c0,
    primaryColor: C.c0, primaryBorderColor: C.g600, primaryTextColor: C.ink, secondaryColor: C.g50, secondaryBorderColor: C.g600, secondaryTextColor: C.ink,
    tertiaryColor: C.c50, tertiaryBorderColor: C.c300, tertiaryTextColor: C.ink, lineColor: C.c700, textColor: C.ink,
    clusterBkg: C.c50, clusterBorder: C.c300, titleColor: C.g700, edgeLabelBackground: C.c0, nodeTextColor: C.ink,
    actorBkg: C.g800, actorBorder: C.g800, actorTextColor: C.c50, actorLineColor: C.c300, signalColor: C.ink, signalTextColor: C.ink,
    labelBoxBkgColor: C.g50, labelBoxBorderColor: C.g600, labelTextColor: C.ink, loopTextColor: C.ink,
    noteBkgColor: C.c100, noteBorderColor: C.c300, noteTextColor: C.ink, activationBkgColor: C.g50, activationBorderColor: C.g600, sequenceNumberColor: C.c0,
    stateBkg: C.c0, stateLabelColor: C.ink, compositeBackground: C.c50, altBackground: C.c100, transitionColor: C.c700, transitionLabelColor: C.ink, specialStateColor: C.g800,
    attributeBackgroundColorOdd: C.c0, attributeBackgroundColorEven: C.c50,
  },
};

// Serve this folder over HTTP (ES modules don't load from file://) and render in Chromium.
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.ttf': 'font/ttf', '.map': 'application/json' };
const INDEX = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:Archivo;src:url("/Archivo.ttf");font-weight:100 900;font-stretch:62% 125%}body{margin:0;font-family:Archivo}</style>
<script type="module">
import mermaid from '/node_modules/mermaid/dist/mermaid.esm.min.mjs';
import elk from '/node_modules/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs';
mermaid.registerLayoutLoaders(elk);
window.mermaid = mermaid;
</script><body></body>`;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(INDEX);
  const file = path.join(here, url);
  if (!file.startsWith(here) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => !!window.mermaid);
await page.evaluate(async () => {
  await document.fonts.load('400 15px Archivo');
  await document.fonts.load('700 15px Archivo');
});

fs.mkdirSync(outDir, { recursive: true });
const keep = new Set();
let failed = false;
for (const [hash, src] of blocks) {
  let svg;
  const render = (source, cfg) =>
    page.evaluate(async ({ id, src, config }) => {
      window.mermaid.initialize(config);
      const { svg } = await window.mermaid.render(id, src);
      return svg;
    }, { id: `dg-${hash}`, src: source, config: cfg });
  const width = (s) => Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(s)?.[1] ?? 0);
  try {
    if (/^\s*(flowchart|graph)\s/.test(src)) {
      // The reading column is ~800 px: try the flowchart top to bottom with ELK (same nodes and edges, only the
      // layout direction changes); keep the author's own layout when that is not narrower than 1200 px.
      svg = await render(src.replace(/^(\s*)(flowchart|graph) LR(?=\s)/, '$1$2 TB'), { ...config, layout: 'elk' });
      if (width(svg) > 1200) svg = await render(src, config);
    } else if (/^\s*stateDiagram/.test(src)) {
      svg = await render(src, { ...config, layout: 'elk' }); // ELK keeps transition labels apart
    } else {
      svg = await render(src, config);
    }
  } catch (err) {
    failed = true;
    const first = src.split('\n')[0];
    const why = String(err.message).split('\n').slice(0, 3).join(' ');
    console.error(`FAILED ${hash} (${first}): ${why}. The page shows this diagram's source instead.`);
    continue;
  }
  // On the page the SVG is inline: use the page's own Archivo (next/font) and size it from the wrapper.
  const out = svg
    .replace(/font-family:\s*"?Archivo"?;?/g, 'font-family:var(--font-text,Archivo),sans-serif;')
    .replace(/font-family="Archivo"/g, 'font-family="var(--font-text,Archivo),sans-serif"');
  fs.writeFileSync(path.join(outDir, `${hash}.svg`), out);
  keep.add(`${hash}.svg`);
  console.log(`${hash}.svg  ${src.split('\n')[0]}  ${(out.length / 1024).toFixed(1)} KB`);
}
for (const f of fs.readdirSync(outDir)) if (!keep.has(f)) fs.rmSync(path.join(outDir, f));
await browser.close();
server.close();
if (failed) process.exit(1);
