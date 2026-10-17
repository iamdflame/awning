import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: 'C:/Users/Dflame/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await p.goto(process.argv[2], { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
console.log(await p.evaluate(() => [document.documentElement.scrollHeight, [...document.querySelectorAll('main > section')].map((s) => s.id || s.className).join(',')]));
await b.close();
