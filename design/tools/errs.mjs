import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const p = await b.newPage(); const e = [];
p.on('pageerror', (x) => e.push(x.message)); p.on('console', (m) => m.type() === 'error' && e.push(m.text()));
await p.goto(process.argv[2], { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
console.log(e.length ? e.join('\n') : 'no errors'); await b.close();
