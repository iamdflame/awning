// Full-page phone capture at 1x (Chrome can't capture >16384 device px, so 2x stitches repeat on long pages).
// node fullphone.mjs <url> <out.png> [waitMs]
import { chromium } from 'playwright';
const [url, out, waitMs = '9600'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(Number(waitMs));
await p.screenshot({ path: out, fullPage: true }); console.log('wrote', out); await b.close();
