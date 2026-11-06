import fs from 'node:fs';
import { setup, launch, close, sleep } from './desk.mjs';
const dir = 'D:/DevCache/m09b/cover';
setup(dir);
fs.cpSync('D:/DevCache/m09/app/data', `${dir}/data`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
const a = await launch({ dir, port: 9411, ud: 'D:/DevCache/m09b/cover-ud' });
const page = a.page;
for (let i = 0; i < 30 && (await page.getByTestId('event-block').count()) === 0; i++) await sleep(300);
await page.getByTestId('event-block').first().click(); await sleep(600);
const r = await page.evaluate(() => {
  const p = document.querySelector('[data-testid="inspector"]').getBoundingClientRect();
  const hits = (b) => b.left < p.right && b.right > p.left && b.top < p.bottom && b.bottom > p.top;
  const headers = [...document.querySelectorAll('[data-testid="day-header"]')].map((h) => ({ text: h.innerText.replace(/\n/g, ' '), hit: hits(h.getBoundingClientRect()) }));
  const cols = [...document.querySelectorAll('[data-testid="day-column"]')].map((c, i) => ({ i, hit: hits(c.getBoundingClientRect()) }));
  return { viewport: [innerWidth, innerHeight], inspector: [Math.round(p.left), Math.round(p.top), Math.round(p.width), Math.round(p.height)], headersCovered: headers.filter((h) => h.hit).map((h) => h.text), columnsUnderPanel: cols.filter((c) => c.hit).map((c) => c.i) };
});
console.log(JSON.stringify(r));
await page.screenshot({ path: process.argv[2] });
console.log('closed:', await close(a));
