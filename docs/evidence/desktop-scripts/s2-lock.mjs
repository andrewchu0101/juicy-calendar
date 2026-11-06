import fs from 'node:fs';
import { setup, launch, close, kill, sha, sleep, text } from './desk.mjs';
const dir = 'D:/DevCache/m09b/lock';
setup(dir);
fs.cpSync('D:/DevCache/m09/app/data', `${dir}/data`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
const snap = () => JSON.stringify(Object.fromEntries(fs.readdirSync(`${dir}/data`, { recursive: true }).filter((f) => !f.endsWith('.juicy.lock') && fs.statSync(`${dir}/data/${f}`).isFile()).map((f) => [f, sha(`${dir}/data/${f}`)])));
const wait = async (page) => { for (let i = 0; i < 30; i++) { if ((await page.getByTestId('event-block').count()) > 0 || /另一個視窗|already open/.test(await text(page))) break; await sleep(300); } await sleep(500); };

const a = await launch({ dir, port: 9361, ud: 'D:/DevCache/m09b/lock-ud1' });
await wait(a.page);
console.log('1st process blocks:', await a.page.getByTestId('event-block').count());
const afterFirst = snap();

const b = await launch({ dir, port: 9362, ud: 'D:/DevCache/m09b/lock-ud2' });
if (b.exited !== null) console.log('2nd process exited with code', b.exited);
else {
  await wait(b.page);
  console.log('2nd process blocks:', await b.page.getByTestId('event-block').count(), '| shows locked notice:', /已在另一個視窗開啟|already open in another window/.test(await text(b.page)));
  console.log('2nd process text sample:', JSON.stringify((await text(b.page)).split('\n').filter((l) => /視窗|window/.test(l)).slice(0, 3)));
  console.log('data unchanged by 2nd process:', afterFirst === snap());
  console.log('2nd closed:', await close(b));
}
// 原視窗正常關閉後，可再次開啟
console.log('1st closed gracefully:', await close(a));
const c = await launch({ dir, port: 9363, ud: 'D:/DevCache/m09b/lock-ud3' });
await wait(c.page);
console.log('3rd process (after graceful close) blocks:', await c.page.getByTestId('event-block').count());
// 被強制結束後，也可再次開啟
kill(c); await sleep(2500);
const d = await launch({ dir, port: 9364, ud: 'D:/DevCache/m09b/lock-ud4' });
await wait(d.page);
console.log('4th process (after force kill) blocks:', await d.page.getByTestId('event-block').count(), '| locked notice:', /已在另一個視窗開啟|already open/.test(await text(d.page)));
console.log('4th closed:', await close(d));
