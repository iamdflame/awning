// Screenshots of the integrated Next.js app (web/) at 1440 and 390, first screen + full page,
// with console errors and horizontal overflow checked on every page.
// node integrated.mjs <baseUrl> <outDir> <name=path> [name=path ...]
//   e.g. node integrated.mjs http://localhost:3100 ../shots/integrated landing=/ for-agents=/for-agents
import { chromium } from 'playwright';
import fs from 'node:fs';

const [base, out, ...pairs] = process.argv.slice(2);
const wait = Number(process.env.WAIT || 2500);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const report = [];
for (const pair of pairs) {
  const i = pair.indexOf('=');
  const name = pair.slice(0, i), path = pair.slice(i + 1);
  for (const [vw, vh, scale, mobile] of [[1440, 900, 1, false], [390, 844, 2, true]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const res = await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(Number(process.env[`WAIT_${name.replace(/-/g, '_').toUpperCase()}`] || wait));
    await page.screenshot({ path: `${out}/${name}-${vw}.png` });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    // full page at 1x (Chrome cannot capture taller than 16384 device px)
    if (scale !== 1) { await page.setViewportSize({ width: vw, height: vh }); }
    const full = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await full.goto(base + path, { waitUntil: 'networkidle' });
    await full.evaluate(() => document.fonts && document.fonts.ready);
    await full.waitForTimeout(1200);
    await full.screenshot({ path: `${out}/${name}-${vw}__full.png`, fullPage: true });
    await full.close();
    report.push(`${name} ${vw}: HTTP ${res.status()} scrollWidth ${sw}${sw > vw ? ' HORIZONTAL OVERFLOW' : ''} errors ${errors.length ? errors.join(' | ') : 'none'}`);
    await page.close();
  }
}
console.log(report.join('\n'));
await browser.close();
