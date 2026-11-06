import fs from 'node:fs';
import { setup, launch, close, sha, sleep, text } from './desk.mjs';
const dir = 'D:/DevCache/m09b/lang';
setup(dir);
fs.cpSync('D:/DevCache/m09/app/data', `${dir}/data`, { recursive: true, filter: (s) => !s.endsWith('.juicy.lock') });
const file = `${dir}/data/app-settings.json`;
let port = 9371;
const open = async () => { const a = await launch({ dir, port: port++, ud: 'D:/DevCache/m09b/lang-ud' }); for (let i = 0; i < 30 && (await a.page.getByTestId('event-block').count()) === 0; i++) await sleep(300); await sleep(500); return a; };
const sel = (page) => page.locator('[data-testid="calendar-toolbar"] select').last();
const info = async (page) => ({ menuValue: await sel(page).inputValue(), options: await sel(page).locator('option').allInnerTexts(), todayButton: await page.getByTestId('calendar-toolbar').locator('button', { hasText: /今天|Today/ }).first().innerText(), firstDayHeader: await page.getByTestId('day-header').first().innerText() });

console.log('settings file exists at start:', fs.existsSync(file));
let a = await open();
console.log('1 first start:', JSON.stringify(await info(a.page)));
await sel(a.page).selectOption('en'); await sleep(800);
console.log('2 after switching to English (no reload):', JSON.stringify(await info(a.page)));
console.log('  settings file:', fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\s+/g, '') : 'MISSING');
console.log('  closed:', await close(a));
a = await open();
console.log('3 restart, English persisted:', JSON.stringify(await info(a.page)));
console.log('  closed:', await close(a));

for (const [name, content] of [['damaged', '{bad'], ['invalid value', '{"language":"fr"}']]) {
  fs.writeFileSync(file, content);
  const h = sha(file);
  a = await open();
  console.log(`4 ${name}: language shown ->`, JSON.stringify(await info(a.page)), '| file untouched on open:', sha(file) === h);
  await sel(a.page).selectOption('en'); await sleep(800);
  console.log('  after next switch, file:', fs.readFileSync(file, 'utf8').replace(/\s+/g, ''));
  console.log('  closed:', await close(a));
}
