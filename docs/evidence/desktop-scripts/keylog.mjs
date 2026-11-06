import { createRequire } from 'node:module';
const require = createRequire('D:/Project/Fun/juicy-calendar/juicy-calendar/package.json');
const { chromium } = require('@playwright/test');
const [port, mode] = process.argv.slice(2);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page = browser.contexts()[0].pages()[0];
if (mode === 'install') {
  await page.evaluate(() => { window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push({ key: e.key, code: e.code, keyCode: e.keyCode, defaultPrevented: e.defaultPrevented, target: e.target?.tagName }), true); });
  console.log('installed');
} else {
  console.log(JSON.stringify(await page.evaluate(() => window.__keys)));
  await page.evaluate(() => { window.__keys = []; });
}
await browser.close().catch(() => {});
