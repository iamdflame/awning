// Element screenshots of page sections for close review.
// node sections.mjs <url> <outdir> <prefix> <width> <selector,selector,...> [waitMs]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out, prefix, width = '1440', sels = 'section', waitMs = '1500'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const w = Number(width);
const browser = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: w < 600 ? 2 : 1, isMobile: w < 600, hasTouch: w < 600 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waitMs));
for (const sel of sels.split(',')) {
  const el = await page.$(sel);
  if (!el) { console.log('missing', sel); continue; }
  const f = `${out}/${prefix}-${sel.replace(/[^a-z0-9]+/gi, '')}-${w}.png`;
  await el.screenshot({ path: f });
  console.log('ok', f);
}
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('scrollWidth', sw, 'viewport', w, sw > w ? 'HORIZONTAL OVERFLOW' : 'no overflow');
console.log('errors', errors.length ? errors.join(' | ') : 'none');
await browser.close();
