import fs from 'node:fs';
import { setup, launch, close, sha, sleep, text } from './desk.mjs';
const dir = 'D:/DevCache/m09b/tc07';
setup(dir);
fs.cpSync('D:/DevCache/m09/app/data', `${dir}/data`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
const good = fs.readdirSync(`${dir}/data/events`).filter((f) => f.endsWith('.json'));
console.log('good events in base:', good.length);
const ev = (id, o = {}) => JSON.stringify({ id, templateId: 'coding', title: 'Bad', startAt: '2026-11-04T02:00:00.000Z', endAt: '2026-11-04T04:00:00.000Z', color: '#E98B87', ...o }, null, 2);
const bad = {
  'bad_a_notjson.json': '{not json',
  'bad_b_equal.json': ev('bad_b_equal', { endAt: '2026-11-04T02:00:00.000Z' }),
  'bad_c_10081.json': ev('bad_c_10081', { endAt: new Date(Date.parse('2026-11-04T02:00:00.000Z') + 10081 * 60000).toISOString() }),
  'bad_d_name31.json': ev('bad_d_name31', { title: '一'.repeat(31) }),
  'bad_e_idmismatch.json': ev('some_other_id'),
  'bad_f_colorred.json': ev('bad_f_colorred', { color: 'red' }),
};
for (const [n, c] of Object.entries(bad)) fs.writeFileSync(`${dir}/data/events/${n}`, c);
const hashes = () => Object.fromEntries(fs.readdirSync(`${dir}/data/events`).map((f) => [f, sha(`${dir}/data/events/${f}`)]));
const before = hashes();
const mtimes = () => Object.fromEntries(fs.readdirSync(`${dir}/data/events`).map((f) => [f, fs.statSync(`${dir}/data/events/${f}`).mtimeMs]));
const mt0 = mtimes();

const app = await launch({ dir, port: 9351, ud: 'D:/DevCache/m09b/tc07-ud' });
if (app.exited !== null) { console.log('APP EXITED', app.exited); process.exit(1); }
const page = app.page;
for (let i = 0; i < 30 && (await page.getByTestId('event-block').count()) === 0; i++) await sleep(300);
await sleep(800);
console.log('blocks shown:', await page.getByTestId('event-block').count());
const t = await text(page);
const notice = t.split('\n').filter((l) => /bad_|損毀|略過|無法|不合法|skipp|invalid|not loaded/i.test(l));
console.log('notice lines:', JSON.stringify(notice));
console.log('hashes unchanged after open:', JSON.stringify(before) === JSON.stringify(hashes()), '| mtimes unchanged:', JSON.stringify(mt0) === JSON.stringify(mtimes()));
// 編輯一個好事件：點第一個區塊，改名稱
await page.getByTestId('event-block').first().click();
await page.getByTestId('inspector-title').fill('Edited');
await page.getByTestId('inspector-title').press('Enter');
await sleep(1500);
const ok = await close(app);
console.log('closed gracefully:', ok);
const after = hashes();
const changed = Object.keys(after).filter((f) => after[f] !== before[f]);
console.log('files changed after edit+close:', JSON.stringify(changed));
console.log('bad files untouched:', Object.keys(bad).every((n) => after[n] === before[n]));
