import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const require = createRequire('D:/Project/Fun/juicy-calendar/juicy-calendar/package.json');
export const { chromium } = require('@playwright/test');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export const SRC_EXE = 'D:/Project/Fun/juicy-calendar/juicy-calendar/src-tauri/target/release/juicy-calendar.exe';

/** 在 dir 放一份免安裝版（exe＋portable.flag）；data 資料夾由呼叫端決定。 */
export function setup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(SRC_EXE, `${dir}/juicy-calendar.exe`);
  fs.writeFileSync(`${dir}/portable.flag`, '');
}

export async function launch({ dir, port, ud, env = {} }) {
  fs.mkdirSync(ud, { recursive: true });
  const child = spawn(`${dir}/juicy-calendar.exe`, [], {
    cwd: dir, stdio: 'ignore',
    env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: ud, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`, ...env },
  });
  let exited = null; child.on('exit', (code) => { exited = code; });
  for (let i = 0; i < 60; i++) {
    if (exited !== null) return { child, exited };
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await sleep(500);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  await sleep(1200);
  return { child, browser, page, exited: null };
}

/** 正常關閉（CloseMainWindow），回傳是否在 10 秒內結束。 */
export async function close(app) {
  await app.browser?.close().catch(() => {});
  spawnSync('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${app.child.pid} -ErrorAction SilentlyContinue; if($p){$null=$p.CloseMainWindow()}`]);
  for (let i = 0; i < 20; i++) { if (app.child.exitCode !== null || app.child.signalCode) return true; await sleep(500); }
  return false;
}
export function kill(app) { spawnSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${app.child.pid} -Force -ErrorAction SilentlyContinue`]); }
export const text = (page) => page.evaluate(() => document.body.innerText);
