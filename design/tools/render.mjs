// Render an HTML page (or SVG) to PNG at an exact size.
// node render.mjs <url> <out.png> <width> <height> [waitMs] [scale]
import { chromium } from 'playwright';
const [url, out, w, h, waitMs = '1500', scale = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(scale) });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out, omitBackground: url.endsWith('.svg') });
console.log('wrote', out);
await browser.close();
