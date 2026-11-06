import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { launch, close, sha, sleep } from './desk.mjs';
const zip = 'D:/Project/Fun/juicy-calendar/juicy-calendar/src-tauri/target/portable/juicy-calendar_0.1.0_x64-portable.zip';
const A = 'D:/DevCache/m09b/m02-a', B = 'D:/DevCache/m09b/m02-b';
for (const d of [A, B]) fs.rmSync(d, { recursive: true, force: true });
fs.mkdirSync(A, { recursive: true });
const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${A}'`]);
console.log('Expand-Archive exit:', r.status);
const root = `${A}/juicy-calendar-portable`;
console.log('unzipped entries:', fs.readdirSync(root), '| data/ exists after Expand-Archive:', fs.existsSync(`${root}/data`));
const open = async (dir, port) => { const a = await launch({ dir, port, ud: `${dir}-ud` }); await sleep(2500); return a; };

let app = await open(root, 9401);
const page = app.page;
console.log('1 start from zip: welcome screen shown?', /建立工作區|Create workspace/.test(await page.evaluate(() => document.body.innerText)), '| blocks:', await page.getByTestId('event-block').count());
console.log('  data/ now:', fs.existsSync(`${root}/data`) ? fs.readdirSync(`${root}/data`) : 'MISSING');
// 建立兩個區塊（拖球）
for (let i = 0; i < 20 && (await page.getByTestId('template-ball').count()) === 0; i++) await sleep(300);
const grid = await page.getByTestId('calendar-columns').boundingBox(); const cols = await page.getByTestId('day-column').count();
const pt = (c, h) => ({ x: grid.x + (grid.width / cols) * (c + 0.5), y: grid.y + (h - 8) * 60 });
for (const [c, h] of [[0, 10], [1, 14]]) {
  const b = await page.getByTestId('template-ball').nth(1).boundingBox(); const t = pt(c, h);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(t.x, t.y - 30, { steps: 6 }); await page.mouse.move(t.x, t.y, { steps: 3 });
  for (let i = 0; i < 40 && (await page.getByTestId('drop-ghost').count()) === 0; i++) await sleep(50);
  await sleep(150); await page.mouse.up(); await sleep(600);
}
await page.locator('[data-testid="calendar-toolbar"] select').last().selectOption('en'); await sleep(900);
console.log('2 created blocks:', await page.getByTestId('event-block').count(), '| language set to English');
console.log('  closed:', await close(app));
const snapA = () => JSON.stringify(Object.fromEntries(['data/app-settings.json', ...fs.readdirSync(`${root}/data/events`).map((f) => `data/events/${f}`)].map((f) => [f.replace(/evt_[0-9a-f]+/, 'evt'), sha(`${root}/${f}`)])));
// 複製整個資料夾到另一處
fs.cpSync(root, `${B}/juicy-calendar-portable`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
app = await open(`${B}/juicy-calendar-portable`, 9402);
for (let i = 0; i < 20 && (await app.page.getByTestId('event-block').count()) === 0; i++) await sleep(300);
const sel = app.page.locator('[data-testid="calendar-toolbar"] select').last();
console.log('3 copied folder run: blocks', await app.page.getByTestId('event-block').count(), '| language menu value:', await sel.inputValue(), '| Today button:', await app.page.getByTestId('calendar-toolbar').locator('button', { hasText: /今天|Today/ }).first().innerText());
console.log('  event files in copy:', fs.readdirSync(`${B}/juicy-calendar-portable/data/events`).length, '| app-settings.json:', fs.readFileSync(`${B}/juicy-calendar-portable/data/app-settings.json`, 'utf8').replace(/\s+/g, ''));
console.log('  closed:', await close(app));
