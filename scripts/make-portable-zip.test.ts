import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS script, not part of the typechecked project
import { assembleLayout, defaultPaths, makeZip, tarCommand } from './make-portable-zip.mjs';

// 暫存位置：每個測試自己的資料夾，用假的 exe（幾個位元組），不碰真實建置輸出與使用者資料。
let work: string;
let exePath: string;
let projectRoot: string;
const LF = String.fromCharCode(10);
const LICENSE_TEXT = ['MIT License', '', 'Copyright (c) 2026 Test', ''].join(LF);
const NOTICES_TEXT = ['# Third-party licenses', ''].join(LF);
const EXE_BYTES = Buffer.from('MZ-not-a-real-executable');

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'juicy-portable-zip-'));
  exePath = join(work, 'built-juicy-calendar.exe');
  writeFileSync(exePath, EXE_BYTES);
  // 專案根目錄：放 LICENSE 與第三方授權聲明（組裝時會一起放進包裡）。
  projectRoot = join(work, 'project-root');
  mkdirSync(projectRoot);
  writeFileSync(join(projectRoot, 'LICENSE'), LICENSE_TEXT);
  writeFileSync(join(projectRoot, 'THIRD-PARTY-LICENSES.md'), NOTICES_TEXT);
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

// TC-14（免安裝 zip 組裝）｜FR-11、AC-03.4、SDS 打包契約：版面含 juicy-calendar.exe、空的 portable.flag、
// 空的 data 資料夾與說明檔；執行檔是輸入檔的逐位元組複本。
describe('免安裝版面 (TC-14, FR-11, AC-03.4)', () => {
  it('包含執行檔、空的 portable.flag、空的 data 資料夾與說明檔', () => {
    const outDir = join(work, 'out');

    const folder = assembleLayout({ exePath, rootDir: projectRoot, outDir });

    expect(readdirSync(folder).sort()).toEqual(['LICENSE', 'README.txt', 'THIRD-PARTY-LICENSES.md', 'data', 'juicy-calendar.exe', 'portable.flag']);
    expect(readFileSync(join(folder, 'juicy-calendar.exe'))).toEqual(EXE_BYTES);
    expect(statSync(join(folder, 'portable.flag')).size).toBe(0);
    expect(statSync(join(folder, 'data')).isDirectory()).toBe(true);
    expect(readdirSync(join(folder, 'data'))).toEqual([]);
    expect(statSync(join(folder, 'README.txt')).size).toBeGreaterThan(0);
  });
});

// TC-14（說明檔）｜FR-11、AC-03.4、ADR-05 條件②、U-12：說明檔雙語（繁中＋英文），且逐項寫明：保留 portable.flag、
// 資料在 data、外部工作區不在整包帶走的範圍、data 無法寫入時不會改存別處、缺少 WebView2 的處理與官方網址、
// 刪除資料夾即可移除程式與其中的使用者資料。句子是提案，待專案擁有者審閱。
describe('說明檔內容 (TC-14, FR-11, U-12)', () => {
  const readme = () => readFileSync(join(assembleLayout({ exePath, rootDir: projectRoot, outDir: join(work, 'out') }), 'README.txt'), 'utf-8');

  it('繁體中文段落逐項寫明', () => {
    const text = readme();
    for (const phrase of [
      '繁體中文',
      'portable.flag',
      'data 資料夾',
      '外部工作區',
      '下次啟動',
      '無法建立或寫入',
      '不會改存',
      'WebView2',
      'https://developer.microsoft.com/microsoft-edge/webview2/',
      '刪除這個資料夾',
      '使用者資料',
    ]) {
      expect(text, `missing zh phrase: ${phrase}`).toContain(phrase);
    }
  });

  it('英文段落逐項寫明', () => {
    const text = readme();
    for (const phrase of [
      'English',
      'portable.flag',
      'data folder',
      'another workspace',
      'next start',
      'cannot be created or written',
      'does not save anywhere else',
      'WebView2',
      'delete this folder',
      'your data',
    ]) {
      expect(text, `missing en phrase: ${phrase}`).toContain(phrase);
    }
  });
});

// TC-14（可重複執行）｜FR-11、AC-03.4、票 017 驗收條件 1：重跑會從頭組裝。上一次的版面若被執行過
// （data 內有使用者資料、多出別的檔案、執行檔是舊的），這些都不得漏進新的包。
describe('可重複執行 (TC-14, FR-11)', () => {
  it('重跑後 data 是空的、多餘的檔案消失、執行檔是新的', () => {
    const outDir = join(work, 'out');
    const folder = assembleLayout({ exePath, rootDir: projectRoot, outDir });
    writeFileSync(join(folder, 'data', 'workspace.json'), '{"private":"user data"}');
    mkdirSync(join(folder, 'data', 'events'));
    writeFileSync(join(folder, 'leftover.txt'), 'stale');
    const newBytes = Buffer.from('MZ-the-second-build');
    writeFileSync(exePath, newBytes);

    const again = assembleLayout({ exePath, rootDir: projectRoot, outDir });

    expect(again).toBe(folder);
    expect(readdirSync(again).sort()).toEqual(['LICENSE', 'README.txt', 'THIRD-PARTY-LICENSES.md', 'data', 'juicy-calendar.exe', 'portable.flag']);
    expect(readdirSync(join(again, 'data'))).toEqual([]);
    expect(readFileSync(join(again, 'juicy-calendar.exe'))).toEqual(newBytes);
  });
});

// TC-14（zip 內容）｜FR-11、AC-03.4、SDS 打包契約：zip 解壓到任意資料夾後，版面與組裝時相同
// （執行檔逐位元組相同、portable.flag 為空、data 是空資料夾、說明檔在）。
describe('zip 檔 (TC-14, FR-11, AC-03.4)', () => {
  it('解壓到別的資料夾後版面與位元組都相同，空的 data 資料夾也在', () => {
    const outDir = join(work, 'out');

    const zip = makeZip({ exePath, rootDir: projectRoot, outDir, version: '0.0.0-test' });

    expect(zip).toBe(join(outDir, 'juicy-calendar_0.0.0-test_x64-portable.zip'));
    expect(existsSync(zip)).toBe(true);
    const elsewhere = join(work, 'unzipped');
    mkdirSync(elsewhere);
    const result = spawnSync(tarCommand(), ['-xf', zip, '-C', elsewhere]);
    expect(result.status, String(result.stderr)).toBe(0);
    const root = join(elsewhere, 'juicy-calendar-portable');
    expect(readdirSync(root).sort()).toEqual(['LICENSE', 'README.txt', 'THIRD-PARTY-LICENSES.md', 'data', 'juicy-calendar.exe', 'portable.flag']);
    expect(readFileSync(join(root, 'juicy-calendar.exe'))).toEqual(EXE_BYTES);
    expect(statSync(join(root, 'portable.flag')).size).toBe(0);
    expect(statSync(join(root, 'data')).isDirectory()).toBe(true);
    expect(readdirSync(join(root, 'data'))).toEqual([]);
  });
});

// 授權與第三方聲明（專案擁有者 2026-11-13）｜MIT 與各第三方授權都要求散布時附上版權與授權文字：
// 包裡的 LICENSE 與 THIRD-PARTY-LICENSES.md 是專案根目錄那兩份的逐位元組複本；少了任何一個就不發。
describe('授權檔 (D-10)', () => {
  it('LICENSE 與 THIRD-PARTY-LICENSES.md 是根目錄檔案的原樣複本', () => {
    const folder = assembleLayout({ exePath, rootDir: projectRoot, outDir: join(work, 'out') });

    expect(readFileSync(join(folder, 'LICENSE'), 'utf-8')).toBe(LICENSE_TEXT);
    expect(readFileSync(join(folder, 'THIRD-PARTY-LICENSES.md'), 'utf-8')).toBe(NOTICES_TEXT);
  });

  it.each(['LICENSE', 'THIRD-PARTY-LICENSES.md'])('缺少 %s 就丟出錯誤，不建立版面', (missing) => {
    rmSync(join(projectRoot, missing));
    const outDir = join(work, 'out');

    expect(() => assembleLayout({ exePath, rootDir: projectRoot, outDir })).toThrow(missing);

    expect(existsSync(join(outDir, 'juicy-calendar-portable'))).toBe(false);
  });

  it('說明檔提到授權檔（中英各一句）', () => {
    const text = readFileSync(join(assembleLayout({ exePath, rootDir: projectRoot, outDir: join(work, 'out') }), 'README.txt'), 'utf-8');

    expect(text).toContain('LICENSE');
    expect(text).toContain('THIRD-PARTY-LICENSES.md');
    expect(text).toContain('授權');
    expect(text).toContain('licenses');
  });
});

// TC-14（缺少執行檔）｜FR-11、票 017：還沒建置就組裝 → 明確的錯誤（說要先建置），不留下半成品版面，
// 上一次成功做出的 zip 原封不動。
describe('缺少執行檔 (TC-14, FR-11)', () => {
  it('丟出說明要先建置的錯誤，不建立版面，也不動既有的 zip', () => {
    const outDir = join(work, 'out');
    const goodZip = makeZip({ exePath, rootDir: projectRoot, outDir, version: '0.0.0-test' });
    const zipBefore = readFileSync(goodZip);
    rmSync(join(outDir, 'juicy-calendar-portable'), { recursive: true });

    expect(() => makeZip({ exePath: join(work, 'no-such.exe'), rootDir: projectRoot, outDir, version: '0.0.0-test' })).toThrow(
      /no-such\.exe.*not found.*build/i,
    );

    expect(existsSync(join(outDir, 'juicy-calendar-portable'))).toBe(false);
    expect(readFileSync(goodZip)).toEqual(zipBefore);
  });
});

// TC-14（預設位置）｜FR-11、票 017 驗收條件 1：輸入是 release 建置的執行檔，輸出在 src-tauri/target 底下
// （已被 .gitignore 排除，不進版控）；版本號取自 package.json。
describe('預設位置 (TC-14, FR-11)', () => {
  it('輸出在不進版控的 target 底下，版本取自 package.json', () => {
    const root = join(work, 'project');
    mkdirSync(root);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', version: '1.2.3' }));

    const paths = defaultPaths(root);

    expect(paths.rootDir).toBe(root);
    expect(paths.exePath).toBe(join(root, 'src-tauri', 'target', 'release', 'juicy-calendar.exe'));
    expect(paths.outDir).toBe(join(root, 'src-tauri', 'target', 'portable'));
    expect(paths.version).toBe('1.2.3');
  });
});
