// 票 027 桌面版驗證：真的調整 Tauri 視窗大小，面板固定佔版面／收合成圓點／換邊後仍選著同一個活動且可編輯，
// 多選選取列仍在工具列、批次刪除與一次復原照常。用法：node s8-dock.mjs <exe 資料夾> <截圖資料夾>
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { launch, close, sleep, SRC_EXE } from './desk.mjs';

const dir = process.argv[2];
const shots = process.argv[3];
fs.mkdirSync(shots, { recursive: true });
const app = await launch({ dir, port: 9431, ud: `${dir}-ud` });
if (app.exited !== null) { console.log('APP EXITED', app.exited); process.exit(1); }
const page = app.page;
for (let i = 0; i < 30 && (await page.getByTestId('event-block').count()) === 0; i++) await sleep(300);

const ps = (code) => spawnSync('powershell', ['-NoProfile', '-Command', code], { encoding: 'utf8' }).stdout.trim();
const setSize = async (w, h) => {
  ps(`Add-Type 'using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll")]public static extern bool SetProcessDPIAware();[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);}'; [W]::SetProcessDPIAware()|Out-Null; $h=(Get-Process -Id ${app.child.pid}).MainWindowHandle; [W]::SetWindowPos($h,[IntPtr]::Zero,20,20,${w},${h},0x0040)|Out-Null`);
  await sleep(900);
  return page.evaluate(() => [innerWidth, innerHeight]);
};
const block = (id) => page.locator(`[data-testid="event-block"]`).nth(id);
const selected = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="event-block"][data-selected="true"]')].map((b) => b.dataset.eventId));
const state = () => page.evaluate(() => {
  const panel = document.querySelector('[data-testid="inspector"]');
  const dot = document.querySelector('[data-testid="inspector-expand"]');
  const sc = document.querySelector('[data-testid="calendar-scroller"]');
  const hdrs = [...document.querySelectorAll('[data-testid="day-header"]')];
  const box = sc.getBoundingClientRect();
  const sunday = hdrs.at(-1).getBoundingClientRect();
  let covers = [];
  if (panel) {
    const p = panel.getBoundingClientRect();
    const hit = (b) => b.width > 1 && b.left < p.right && b.right > p.left && b.top < p.bottom && b.bottom > p.top;
    hdrs.forEach((h, i) => hit(h.getBoundingClientRect()) && covers.push(`header ${i}`));
    document.querySelectorAll('[data-testid="day-column"]').forEach((c, i) => hit(c.getBoundingClientRect()) && covers.push(`column ${i}`));
    document.querySelectorAll('[data-testid="calendar-toolbar"] button, [data-testid="calendar-toolbar"] select').forEach((c) => hit(c.getBoundingClientRect()) && covers.push('toolbar'));
  }
  return { panel: panel ? { docked: panel.dataset.docked, left: Math.round(panel.getBoundingClientRect().left), width: Math.round(panel.getBoundingClientRect().width) } : null, dot: !!dot, covers, innerHScroll: sc.scrollWidth > sc.clientWidth, sundayVisible: sunday.right <= box.right + 1, colMin: Math.round(Math.min(...[...document.querySelectorAll('[data-testid="day-column"]')].map((c) => c.getBoundingClientRect().width))), toolbarH: Math.round(document.querySelector('[data-testid="calendar-toolbar"]').getBoundingClientRect().height), bar: !!document.querySelector('[data-testid="selection-bar"]') && document.querySelector('[data-testid="calendar-toolbar"]').contains(document.querySelector('[data-testid="selection-bar"]')) };
});
const log = async (label, size) => console.log(`${label} [client ${size.join('×')}] selected=${JSON.stringify(await selected())} ${JSON.stringify(await state())}`);

console.log('events on disk at start:', fs.readdirSync(`${dir}/data/events`).filter((f) => f.endsWith('.json')).length);
let size = await setSize(1320, 900);
await block(0).click(); await sleep(600);
const pickedId = (await selected())[0];
await log('1 wide, one block selected', size);
await page.screenshot({ path: `${shots}/027-1-wide.png` });

for (const w of [1100, 1040, 1000, 900]) {
  size = await setSize(w, 640);
  await log(`2 shrink to outer ${w}`, size);
  if (w === 900) await page.screenshot({ path: `${shots}/027-2-narrow.png` });
}
console.log('   same event still selected after shrinking:', JSON.stringify(await selected()) === JSON.stringify([pickedId]), `(${pickedId})`);
await page.getByTestId('inspector-expand').click(); await sleep(500);
await log('3 narrow, dot clicked (overlay)', size);
await page.screenshot({ path: `${shots}/027-3-narrow-overlay.png` });
await page.getByTestId('inspector-title').fill('Narrow edit'); await page.getByTestId('inspector-title').press('Enter'); await sleep(1500);
console.log('   edited in the overlay -> file on disk:', fs.readdirSync(`${dir}/data/events`).some((f) => JSON.parse(fs.readFileSync(`${dir}/data/events/${f}`, 'utf8')).title === 'Narrow edit'));

for (const w of [1000, 1100, 1320]) {
  size = await setSize(w, 900);
  await log(`4 widen to outer ${w}`, size);
}
console.log('   same event still selected after widening:', JSON.stringify(await selected()) === JSON.stringify([pickedId]));
await page.screenshot({ path: `${shots}/027-4-wide-again.png` });
await page.getByTestId('inspector-title').fill('Wide edit'); await page.getByTestId('inspector-title').press('Enter'); await sleep(1500);
console.log('   edited in the docked panel -> file on disk:', fs.readdirSync(`${dir}/data/events`).some((f) => JSON.parse(fs.readFileSync(`${dir}/data/events/${f}`, 'utf8')).title === 'Wide edit'));

// 多選：選取列仍在工具列，批次刪除與一次復原
const count = async () => page.getByTestId('event-block').count();
const files = () => fs.readdirSync(`${dir}/data/events`).filter((f) => f.endsWith('.json')).length;
for (const [label, w] of [['wide', 1320], ['narrow', 900]]) {
  size = await setSize(w, 700);
  await page.keyboard.press('Escape'); await sleep(300);
  const grid = await page.getByTestId('calendar-columns').boundingBox(); const cols = await page.getByTestId('day-column').count();
  const pt = (c, h, m = 0) => ({ x: grid.x + (grid.width / cols) * (c + 0.5), y: grid.y + (h - 8) * 60 + m });
  const from = pt(2, 14), to = pt(0, 10, 30);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up(); await sleep(500);
  await log(`5 ${label}: marquee`, size);
  const before = await count();
  await page.getByTestId('selection-delete').click(); await sleep(1500);
  console.log(`   after clicking 刪除: blocks ${before} -> ${await count()}, files on disk ${files()}`);
  await page.keyboard.press('Control+z'); await sleep(1500);
  console.log(`   after one Ctrl+Z: blocks ${await count()}, files on disk ${files()}`);
}
console.log('closed gracefully:', await close(app));
