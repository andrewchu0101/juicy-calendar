import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { externalSources } from '../test-support/cspCheck';
import { findExternalReferences, findNetworkCalls } from '../test-support/networkCalls';

// TC-15（離線靜態檢查）｜NFR-03、票 018 驗收條件 1：安全政策只允許本機與 IPC 的連線來源。
// 靜態檢查看的是「設定怎麼寫」，不能證明實際沒有連線；實際監看由人工 M-06 負責。
describe('the CSP checker itself (mutation check for TC-15)', () => {
  it('flags an external domain in connect-src, with the directive it came from', () => {
    const csp = { 'default-src': "'self'", 'connect-src': "'self' https://evil.example ipc:" };

    expect(externalSources(csp)).toEqual([{ directive: 'connect-src', source: 'https://evil.example' }]);
  });

  // 本機來源不能被誤報：自己、IPC（Tauri 在 Windows 用 http://ipc.localhost）、data:、行內樣式。
  it('does not flag the local sources the app really uses', () => {
    const csp = {
      'default-src': "'self'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data:",
      'connect-src': 'ipc: http://ipc.localhost',
    };

    expect(externalSources(csp)).toEqual([]);
  });

  // 特徵化（加入時沒有紅燈：白名單的自然寫法已涵蓋）：通配符、只有協定的來源、裸網域、拼錯的關鍵字都算外部。
  it.each(['*', 'https:', 'http:', 'wss:', 'example.com', '*.example.com', 'https://cdn.example.com', "'slef'"])(
    'flags %s as external',
    (source) => {
      expect(externalSources({ 'connect-src': `ipc: ${source}` })).toEqual([{ directive: 'connect-src', source }]);
    },
  );
});

// TC-15｜NFR-03、票 018 驗收條件 1：真實的安全政策（src-tauri/tauri.conf.json 的 app.security.csp）。
// 加入時真實設定已符合，所以沒有紅燈；變異檢查：把 https://evil.example 加進 connect-src 後這裡會轉紅（見票 018 紀錄）。
describe('the real CSP in tauri.conf.json (TC-15, NFR-03)', () => {
  const config = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf-8')) as {
    app: { security: { csp: Record<string, string> } };
  };
  const csp = config.app.security.csp;

  it('allows no external source in any directive', () => {
    expect(externalSources(csp)).toEqual([]);
  });

  it('lets connect-src reach only the local IPC, and keeps default-src on the app itself', () => {
    expect(csp['connect-src']?.split(/\s+/).sort()).toEqual(['http://ipc.localhost', 'ipc:']);
    expect(csp['default-src']).toBe("'self'");
  });
});

// TC-15｜NFR-03、票 018 驗收條件 2：原始碼掃描器本身（變異檢查）。
describe('the network-call scanner itself (mutation check for TC-15)', () => {
  it('flags the browser network APIs, called directly or through window/globalThis/self', () => {
    const bad = [
      "fetch('/api');",
      "window.fetch('/api');",
      "globalThis.fetch('/api');",
      "const x = new XMLHttpRequest();",
      "const s = new WebSocket('wss://example.com');",
      "const e = new EventSource('/events');",
      "navigator.sendBeacon('/log', '');",
      "const m = await import('https://cdn.example.com/lib.js');",
    ].join(String.fromCharCode(10));

    expect(findNetworkCalls(bad)).toEqual([
      { line: 1, what: 'fetch' },
      { line: 2, what: 'fetch' },
      { line: 3, what: 'fetch' },
      { line: 4, what: 'XMLHttpRequest' },
      { line: 5, what: 'WebSocket' },
      { line: 6, what: 'EventSource' },
      { line: 7, what: 'sendBeacon' },
      { line: 8, what: 'import(url)' },
    ]);
  });

  // 本機檔案的動態載入（拆包）不是網路；只有指向網址的 import() 才算，無法判斷的動態參數也保守回報。
  it('does not flag import() of a local file, but flags a non-literal argument it cannot judge', () => {
    const code = [
      "const a = await import('./Panel');",
      "const b = await import('../features/calendar/Grid');",
      "const c = await import(path);",
    ].join(String.fromCharCode(10));

    expect(findNetworkCalls(code)).toEqual([{ line: 3, what: 'import(dynamic)' }]);
  });

  // 外部網址：字串、樣板字串、JSX 屬性裡的 http(s)／ws(s)／ftp 位址。命名空間與本機位址不是連線，不報。
  it('flags external addresses in strings, templates and JSX attributes, but not namespaces or local addresses', () => {
    const code = [
      "const a = 'https://example.com/api';",
      "const b = `wss://example.com/${room}`;",
      "export const C = () => <img src=\"http://cdn.example.com/x.png\" />;",
      "const d = 'http://www.w3.org/2000/svg';",
      "const e = 'http://localhost:1421';",
      "const f = 'http://ipc.localhost';",
      "const g = 'http://127.0.0.1:8080';",
      "// see https://example.com/docs in a comment",
    ].join(String.fromCharCode(10));

    expect(findNetworkCalls(code, 'c.tsx')).toEqual([
      { line: 1, what: 'url https://example.com/api' },
      { line: 2, what: 'url wss://example.com/' },
      { line: 3, what: 'url http://cdn.example.com/x.png' },
    ]);
  });
});

// TC-15｜NFR-03、票 018 驗收條件 2：HTML 與 CSS 裡的外部引用（變異檢查）。
describe('the HTML/CSS reference scanner itself (mutation check for TC-15)', () => {
  it('flags external scripts, stylesheets, images and @import, but not the SVG namespace or local addresses', () => {
    const text = [
      '<script type="module" src="https://cdn.example.com/app.js"></script>',
      '<link rel="stylesheet" href="https://fonts.example.com/css?family=X">',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      '<img src="/local.png">',
      "@import url('https://fonts.example.com/x.css');",
      '.a { background: url(http://cdn.example.com/bg.png); }',
      '<a href="http://localhost:1421/">dev</a>',
    ].join(String.fromCharCode(10));

    expect(findExternalReferences(text)).toEqual([
      { line: 1, what: 'url https://cdn.example.com/app.js' },
      { line: 2, what: 'url https://fonts.example.com/css' },
      { line: 5, what: 'url https://fonts.example.com/x.css' },
      { line: 6, what: 'url http://cdn.example.com/bg.png' },
    ]);
  });
});

// TC-15｜NFR-03、票 018 驗收條件 2：真實原始碼沒有對外網路呼叫。
// 掃描方式：解析 src 底下每個非測試的 .ts／.tsx（排除 *.test.* 與 src/test-support，那是測試用程式碼），
// 找網路 API 呼叫（fetch、XMLHttpRequest、WebSocket、EventSource、sendBeacon、指向網址或無法判斷的 import()）
// 與字串裡的外部網址；另掃 index.html 與 src 底下的 .css。限制（靜態檢查的邊界，這就是 M-06 不能省的原因）：
//  · 看不到間接呼叫：const f = window['fe' + 'tch']、別名、eval、透過第三方套件發出的連線；
//  · 看不到 Rust 端（src-tauri）：Cargo 依賴與 capabilities 權限不在這個測試內；
//  · 看不到執行期組出來的網址（字串相加、環境變數）；
//  · 打包後的 WebView 本身（更新、遙測、安全瀏覽）的連線不在原始碼裡，只能靠 M-06 監看。
// 加入時真實原始碼已符合，所以沒有紅燈；變異檢查：在 src 內暫時加入 fetch 呼叫後這裡轉紅（見票 018 紀錄）。
const SRC = fileURLToPath(new URL('../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const shipped = (path: string) => !/[.]test[.]tsx?$/.test(path) && !relative(SRC, path).startsWith('test-support');
const codeFiles = walk(SRC).filter((path) => /[.]tsx?$/.test(path) && shipped(path));
const markupFiles = [join(ROOT, 'index.html'), ...walk(SRC).filter((path) => path.endsWith('.css'))];

describe('the real source has no outgoing network calls (TC-15, NFR-03)', () => {
  it('scans a meaningful number of files, so an empty scan cannot pass by accident', () => {
    const names = codeFiles.map((path) => relative(SRC, path).split(String.fromCharCode(92)).join('/'));
    expect(names).toContain('app/main.tsx');
    expect(codeFiles.length).toBeGreaterThan(30);
    expect(markupFiles.map((path) => relative(ROOT, path).split(String.fromCharCode(92)).join('/'))).toEqual(
      expect.arrayContaining(['index.html', 'src/app/index.css']),
    );
  });

  it('finds no network API call or external address in the shipped TypeScript', () => {
    const findings = codeFiles.flatMap((path) =>
      findNetworkCalls(readFileSync(path, 'utf-8'), path).map((item) => `${relative(ROOT, path)}:${item.line} ${item.what}`),
    );
    expect(findings).toEqual([]);
  });

  it('finds no external reference in index.html or the stylesheets', () => {
    const findings = markupFiles.flatMap((path) =>
      findExternalReferences(readFileSync(path, 'utf-8')).map((item) => `${relative(ROOT, path)}:${item.line} ${item.what}`),
    );
    expect(findings).toEqual([]);
  });
});
