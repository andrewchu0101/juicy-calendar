// 桌面版 M-09 批次刪除驗收：經 CDP 連到真正的 Tauri webview（WebView2）。
// 用法：node m09.mjs <cdpPort> <dataDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('D:/Project/Fun/juicy-calendar/juicy-calendar/package.json');
const { chromium } = require('@playwright/test');
const [port, dataDir] = process.argv.slice(2);
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const files = () => (fs.existsSync(`${dataDir}/events`) ? fs.readdirSync(`${dataDir}/events`).filter((f) => f.endsWith('.json')).sort() : []);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page = browser.contexts()[0].pages()[0];
log('title:', await page.title(), '| viewport:', JSON.stringify(await page.evaluate(() => [innerWidth, innerHeight])));
const box = async (sel, n = 0) => (await page.getByTestId(sel).nth(n).boundingBox());
const count = (sel) => page.getByTestId(sel).count();

const grid = await box('calendar-columns');
const cols = await count('day-column');
log('grid', JSON.stringify(grid), 'columns', cols, 'balls', await count('template-ball'), 'blocks', await count('event-block'));
const pt = (col, hour, min = 0) => ({ x: grid.x + (grid.width / cols) * (col + 0.5), y: grid.y + (hour - 8) * 60 + min });

async function dropBall(target) {
  const b = await box('template-ball', 0);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  await page.mouse.move(target.x, target.y, { steps: 3 });
  for (let i = 0; i < 40 && (await count('drop-ghost')) === 0; i++) await sleep(50);
  await sleep(150);
  await page.mouse.up();
  await sleep(500);
}
const selectedIds = () => page.locator('[data-testid="event-block"][data-selected="true"]').count();
const state = async (label) => log(`${label}: blocks=${await count('event-block')} selected=${await selectedIds()} files=${files().length} activeElement=${await page.evaluate(() => document.activeElement?.tagName)}`);
async function marquee(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await sleep(300);
}

const mode = process.argv[4] ?? 'run';
if (mode === 'run') {
  const hours = [[0, 10], [1, 10], [0, 16]];
  const visibleBottom = grid.y + grid.height;
  log('visible to', visibleBottom, '16:00 at y=', pt(0, 16).y);
  for (const [c, h] of hours) await dropBall(pt(c, h));
  await sleep(800);
  await state('after create 3');
  for (const key of ['Delete', 'Backspace']) {
    // 框選 A（週一 10:00）與 B（週二 10:00）：由空白處拉框
    await marquee(pt(0, 9, 30), pt(1, 11, 30)).catch((e) => log('marquee err', e.message));
    await state(`${key}: after marquee`);
    await page.keyboard.press(key);
    await sleep(900);
    await state(`${key}: after press`);
    await page.keyboard.press('Control+z');
    await sleep(900);
    await state(`${key}: after Ctrl+Z`);
    log('files:', files().join(','));
  }
}
const blocks = async () => page.evaluate(() => [...document.querySelectorAll('[data-testid="event-block"]')].map((b) => ({ time: b.querySelector('[data-testid="event-time"]')?.textContent, col: Math.round(b.getBoundingClientRect().x), sel: b.dataset.selected })));
if (mode === 'prep') {
  await marquee(pt(0, 9, 30), pt(1, 11, 30));
  await state('prep');
  log('blocks', JSON.stringify(await blocks()));
  log('title/focus', await page.evaluate(() => `${document.hasFocus()} ${document.activeElement?.tagName}`));
}
if (mode === 'move') {
  // 抓住 A（週一 10:30）拖到週二 12:30：選中的兩個一起 +1 天 +2 小時
  const from = pt(0, 10, 30), to = pt(1, 12, 30);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up(); await sleep(1500);
  await state('after batch move');
  log('blocks', JSON.stringify(await blocks()));
}
if (mode === 'check') {
  await sleep(900);
  await state('check');
  log('blocks', JSON.stringify(await blocks()));
  log('files:', files().join(','));
}
await browser.close().catch(() => {});
