import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, sleep } from './desk.mjs';
const exe = 'D:/Project/Fun/juicy-calendar/juicy-calendar/src-tauri/target/debug/juicy-calendar.exe';
for (let run = 1; run <= 4; run++) {
  const ws = `D:/DevCache/tmp/smoke-timing-${run}/Workspace`; fs.rmSync(`D:/DevCache/tmp/smoke-timing-${run}`, { recursive: true, force: true }); fs.mkdirSync(ws, { recursive: true });
  const port = 9420 + run;
  const t0 = Date.now();
  const child = spawn(exe, [], { stdio: 'ignore', env: { ...process.env, JUICY_SMOKE_WORKSPACE: ws, WEBVIEW2_USER_DATA_FOLDER: `D:/DevCache/tmp/smoke-timing-${run}/ud`, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
  let browser; for (let i = 0; i < 80; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); break; } catch { await sleep(250); } }
  const page = browser.contexts()[0].pages()[0];
  const tCdp = Date.now() - t0;
  let tBall = null;
  for (let i = 0; i < 100; i++) { if (await page.evaluate(() => !!document.querySelector('[data-testid="template-ball"]'))) { tBall = Date.now() - t0; break; } await sleep(100); }
  const body = await page.evaluate(() => document.body.innerText.slice(0, 80).replace(/\n/g, ' | '));
  console.log(`run ${run}: CDP reachable at ${tCdp} ms, first template-ball at ${tBall} ms (script is injected at ~2000 ms after the Tauri setup)`, '| body:', body);
  await browser.close().catch(() => {});
  spawnSync('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if($p){$null=$p.CloseMainWindow()}`]); await sleep(3000);
}
