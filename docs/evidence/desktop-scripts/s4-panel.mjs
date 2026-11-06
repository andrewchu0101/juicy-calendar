import fs from 'node:fs';
import { setup, launch, close, sha, sleep } from './desk.mjs';
const dir = 'D:/DevCache/m09b/panel';
setup(dir);
fs.cpSync('D:/DevCache/m09/app/data', `${dir}/data`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
const a = await launch({ dir, port: 9381, ud: 'D:/DevCache/m09b/panel-ud' });
const page = a.page;
for (let i = 0; i < 30 && (await page.getByTestId('event-block').count()) === 0; i++) await sleep(300);
const files = () => Object.fromEntries(fs.readdirSync(`${dir}/data/events`).map((f) => [f, sha(`${dir}/data/events/${f}`)]));
const val = (id) => page.getByTestId(id).inputValue();
const panel = async () => JSON.stringify({ date: await val('inspector-date'), start: await val('inspector-start'), end: await val('inspector-end'), h: await val('inspector-duration-hours'), m: await val('inspector-duration-minutes') });
await page.getByTestId('event-block').first().click(); await sleep(500);
console.log('initial panel:', await panel());
const H = page.getByTestId('inspector-duration-hours'), M = page.getByTestId('inspector-duration-minutes'), E = page.getByTestId('inspector-end');
const base = files();
console.log('-- rejections (fields revert, files unchanged) --');
for (const [h, m] of [['0', '0'], ['0', '0.4'], ['1.5', '0'], ['-1', '30'], ['0', '10081'], ['169', '0'], ['', '']]) {
  await H.fill(h); await M.fill(m); await M.press('Enter'); await sleep(500);
  console.log(`  hours=${JSON.stringify(h)} minutes=${JSON.stringify(m)} -> panel ${await panel()} | files unchanged: ${JSON.stringify(files()) === JSON.stringify(base)}`);
}
for (const t of ['09:00', '10:00']) { await E.fill(t); await E.press('Enter'); await sleep(500); console.log(`  end=${t} (not after start) -> end field ${await val('inspector-end')} | files unchanged: ${JSON.stringify(files()) === JSON.stringify(base)}`); }
console.log('-- acceptances --');
await H.fill('1'); await M.fill('90'); await M.press('Enter'); await sleep(900);
console.log('  1 h 90 min ->', await panel());
await H.fill('0'); await M.fill('1.4'); await M.press('Enter'); await sleep(900);
console.log('  0 h 1.4 min ->', await panel());
await H.fill('15'); await M.fill(''); await M.press('Enter'); await sleep(900);
console.log('  15 h, minutes blank ->', await panel());
await H.fill(''); await M.fill('120'); await M.press('Enter'); await sleep(900);
console.log('  hours blank, 120 min ->', await panel());
await E.fill('11:30'); await E.press('Enter'); await sleep(900);
console.log('  end 11:30 ->', await panel());
console.log('files changed vs base:', Object.keys(files()).filter((f) => files()[f] !== base[f]));
console.log('closed:', await close(a));
