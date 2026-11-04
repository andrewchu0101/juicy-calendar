// Assembles the portable .zip (FR-11, ADR-05): juicy-calendar.exe, an empty portable.flag, an empty
// data/ folder and a README.txt. Paths are parameters so tests never touch the real build output.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const PACKAGE_DIR = 'juicy-calendar-portable';

const WEBVIEW2_URL = 'https://developer.microsoft.com/microsoft-edge/webview2/';
// Windows line endings, so Notepad shows the file properly.
const EOL = String.fromCharCode(13, 10);

// Proposal text, pending review by the project owner (ticket 017). Two languages in one file, like the app.
const README_TEXT = [
  'Juicy Calendar（免安裝版 / portable）',
  '======================================',
  '',
  '【繁體中文】',
  '',
  '1. 直接執行 juicy-calendar.exe 即可，不需要安裝。',
  '2. 請保留 portable.flag（與執行檔放在一起的空檔案）。有這個檔案，程式才會以免安裝模式執行；刪掉它就變成一般模式。',
  '3. 你的區塊與設定（例如語言）都放在執行檔旁的 data 資料夾。把整個資料夾複製或搬到別處或另一台電腦，內容會跟著走。',
  '4. 每次啟動一律開啟 data 資料夾。如果你手動開啟了別的外部工作區，那份資料不在「整包帶走」的範圍內，而且下次啟動仍會回到 data。',
  '5. 如果程式無法建立或寫入 data 資料夾（例如放在唯讀的位置），會顯示錯誤，而且不會改存到其他地方。請把整個資料夾移到可以寫入的位置再開啟。',
  '6. 需要 Microsoft Edge WebView2 執行階段。若電腦缺少它，程式會顯示說明並結束；請用瀏覽器到下列官方網頁自行下載後再開啟（程式本身不會連網）：',
  `   ${WEBVIEW2_URL}`,
  '7. 沒有解除安裝步驟：刪除這個資料夾，就移除了程式與其中的使用者資料。WebView2 可能另在這台電腦留下快取，不在這個資料夾內。',
  '',
  '[English]',
  '',
  '1. Just run juicy-calendar.exe. There is nothing to install.',
  '2. Keep portable.flag (the empty file next to the executable). It is what turns portable mode on; if you delete it the app runs in normal mode.',
  '3. Your blocks and settings (such as the language) live in the data folder next to the executable. Copy or move the whole folder to another place or computer and they come with it.',
  '4. Every start opens the data folder. If you open another workspace by hand, that folder is not part of what travels with this one, and the next start returns to data.',
  '5. If the data folder cannot be created or written (for example a read-only location), the app shows an error and does not save anywhere else. Move the whole folder somewhere writable and start it again.',
  '6. The Microsoft Edge WebView2 Runtime is required. If it is missing, the app shows a help window and exits; download it in a browser from the official page below, then start the app again (the app itself never goes online):',
  `   ${WEBVIEW2_URL}`,
  '7. There is no uninstaller: delete this folder to remove the program and your data inside it. WebView2 may leave its own cache elsewhere on this computer.',
  '',
].join(EOL);

/** Builds the folder that gets zipped and returns its path. */
export function assembleLayout({ exePath, outDir }) {
  // Check first: failing later would leave a half-built folder behind.
  if (!existsSync(exePath)) {
    throw new Error(`${exePath} not found: the executable has not been built. Build it first (npx tauri build --no-bundle).`);
  }
  const folder = join(outDir, PACKAGE_DIR);
  // Start clean: a folder that was run once holds user data that must never end up in a release.
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(join(folder, 'data'), { recursive: true });
  copyFileSync(exePath, join(folder, 'juicy-calendar.exe'));
  writeFileSync(join(folder, 'portable.flag'), '');
  writeFileSync(join(folder, 'README.txt'), README_TEXT);
  return folder;
}

/** The Windows built-in bsdtar understands `-a` (zip by extension); the GNU tar on PATH in Git Bash does not. */
export function tarCommand() {
  return process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe') : 'tar';
}

/** Assembles the folder and zips it. Returns the path of the .zip inside `outDir`. */
export function makeZip({ exePath, outDir, version }) {
  assembleLayout({ exePath, outDir });
  const zipPath = join(outDir, `juicy-calendar_${version}_x64-portable.zip`);
  rmSync(zipPath, { force: true });
  // -C makes the archive start at the package folder, so entries are `juicy-calendar-portable/...`.
  const result = spawnSync(tarCommand(), ['-a', '-cf', zipPath, '-C', outDir, PACKAGE_DIR]);
  if (result.status !== 0) {
    throw new Error(`Could not create the zip (exit ${result.status}): ${String(result.stderr).trim()}`);
  }
  return zipPath;
}

/** Where the release executable is read from and where the package goes, relative to the project root. */
export function defaultPaths(rootDir) {
  const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return {
    exePath: join(rootDir, 'src-tauri', 'target', 'release', 'juicy-calendar.exe'),
    // Under src-tauri/target, which .gitignore excludes: the package never reaches version control.
    outDir: join(rootDir, 'src-tauri', 'target', 'portable'),
    version,
  };
}

// Command line: `node scripts/make-portable-zip.mjs` from the project root, after `npx tauri build --no-bundle`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const zipPath = makeZip(defaultPaths(process.cwd()));
    process.stdout.write(`Created ${zipPath}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
