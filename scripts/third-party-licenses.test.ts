import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS script, not part of the typechecked project
import { buildEntries, groupTexts, normalizeText, npmProductionPackages, renderMarkdown } from './third-party-licenses.mjs';

// 授權與第三方聲明（專案擁有者 2026-11-13：Calendar 採 MIT；散布的 .exe 內含的第三方程式要附上它們的版權與授權文字）。
// 預期值是授權條文本身與人工算例（例如「兩個套件文字只差空白 → 同一組」），不呼叫實作去算答案。
const root = process.cwd();
const sha256 = (path: string) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');

const MIT_A = 'MIT License\n\nCopyright (c) 2020 Alice\n\nPermission is hereby granted, free of charge, to any person';
const pkg = (name: string, license: string, extra: Record<string, unknown> = {}) => ({
  ecosystem: 'rust',
  name,
  version: '1.0.0',
  license,
  authors: [],
  repository: `https://example.test/${name}`,
  dir: `/fake/${name}`,
  ...extra,
});

describe('normalizeText', () => {
  it('把連續空白與換行壓成一個空格並去頭尾，讓只差排版的同一份條文視為相同', () => {
    expect(normalizeText('  A  b\r\n c \n')).toBe('A b c');
  });
});

describe('groupTexts（相同的授權文字只印一次，列出使用它的套件）', () => {
  it('兩個只差空白的 MIT 文字合成一組；版權人不同的另成一組；套件名稱排序', () => {
    const entries = [
      { ...pkg('b-crate', 'MIT'), texts: [MIT_A.replace('\n\n', '\r\n\r\n')], synthesized: false },
      { ...pkg('a-crate', 'MIT'), texts: [MIT_A], synthesized: false },
      { ...pkg('c-crate', 'MIT'), texts: [MIT_A.replace('Alice', 'Bob')], synthesized: false },
    ];

    const groups = groupTexts(entries);

    expect(groups.map((g: { packages: string[] }) => g.packages)).toEqual([['a-crate@1.0.0', 'b-crate@1.0.0'], ['c-crate@1.0.0']]);
  });
});

describe('buildEntries（找不到授權檔的套件）', () => {
  const noFiles = () => [] as string[];

  it('MIT 且沒有授權檔：用 Cargo.toml 的作者當版權人，套上標準 MIT 條文，並標示為合成', () => {
    const [entry] = buildEntries([pkg('webview2-com', 'MIT', { authors: ['Ada Lovelace <ada@example.test>'] })], { readLicenseTexts: noFiles });

    expect(entry.synthesized).toBe(true);
    expect(entry.texts[0]).toContain('Copyright (c) Ada Lovelace');
    expect(entry.texts[0]).not.toContain('ada@example.test');
    expect(entry.texts[0]).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
  });

  it('BSD-3-Clause 且沒有授權檔：套上標準 BSD 三條款', () => {
    const [entry] = buildEntries([pkg('alloc-stdlib', 'BSD-3-Clause', { authors: ['Dropbox, Inc.'] })], { readLicenseTexts: noFiles });

    expect(entry.texts[0]).toContain('Copyright (c) Dropbox, Inc.');
    expect(entry.texts[0]).toContain('Redistribution and use in source and binary forms');
    expect(entry.texts[0]).toContain('Neither the name of the copyright holder');
  });

  it('沒有授權檔但同一個 repository 的另一個套件有：沿用那份（同專案共用一份 LICENSE）', () => {
    const sibling = 'Copyright (c) 2016 Dropbox, Inc. All rights reserved. Redistribution and use...';
    const read = (dir: string) => (dir === '/fake/alloc-no-stdlib' ? [sibling] : []);

    const entries = buildEntries(
      [
        pkg('alloc-no-stdlib', 'BSD-3-Clause', { repository: 'https://github.com/dropbox/rust-alloc-no-stdlib' }),
        pkg('alloc-stdlib', 'BSD-3-Clause', { repository: 'https://github.com/dropbox/rust-alloc-no-stdlib', authors: ['Daniel Reiter Horn <d@example.test>'] }),
      ],
      { readLicenseTexts: read },
    );

    const stdlib = entries.find((e: { name: string }) => e.name === 'alloc-stdlib');
    expect(stdlib.texts).toEqual([sibling]);
    expect(stdlib.synthesized).toBe(true);
  });

  it('沒有授權檔、也沒有同 repository 的夥伴：用以 repository 網址登記的補充文字（從上游原樣複製）', () => {
    const upstream = 'MIT License\n\nCopyright (c) 2021 Bill Avery\n';

    const [entry] = buildEntries([pkg('webview2-com', 'MIT', { repository: 'https://github.com/wravery/webview2-rs' })], {
      readLicenseTexts: noFiles,
      supplements: { 'https://github.com/wravery/webview2-rs': upstream },
    });

    expect(entry.texts).toEqual([upstream]);
    expect(entry.synthesized).toBe(true);
  });

  it('MPL-2.0 且沒有授權檔：沿用同授權、有授權檔的另一個套件的全文', () => {
    const donorText = 'Mozilla Public License Version 2.0 ...full text...';
    const read = (dir: string) => (dir === '/fake/cssparser' ? [donorText] : []);

    const entries = buildEntries([pkg('cssparser', 'MPL-2.0'), pkg('selectors', 'MPL-2.0')], { readLicenseTexts: read });

    const selectors = entries.find((e: { name: string }) => e.name === 'selectors');
    expect(selectors.texts).toEqual([donorText]);
    expect(selectors.synthesized).toBe(true);
  });

  it('無法補出授權文字時丟出錯誤，不默默漏掉：沒有作者的 MIT、不認得的授權', () => {
    expect(() => buildEntries([pkg('x', 'MIT')], { readLicenseTexts: noFiles })).toThrow(/no license text.*x@1\.0\.0/i);
    expect(() => buildEntries([pkg('y', 'LicenseRef-Weird', { authors: ['Z'] })], { readLicenseTexts: noFiles })).toThrow(/no license text.*y@1\.0\.0/i);
  });

  it('有授權檔就原樣使用，不合成', () => {
    const [entry] = buildEntries([pkg('ok', 'MIT')], { readLicenseTexts: () => [MIT_A] });

    expect(entry.texts).toEqual([MIT_A]);
    expect(entry.synthesized).toBe(false);
  });
});

describe('renderMarkdown', () => {
  const entries = [
    { ...pkg('zeta', 'MIT'), texts: [MIT_A], synthesized: false },
    { ...pkg('alpha', 'MPL-2.0'), texts: ['MPL text'], synthesized: false },
  ];
  const meta = { hashes: { 'package-lock.json': 'aaa', 'src-tauri/Cargo.lock': 'bbb' }, scope: 'test scope' };

  it('列出每個套件的名稱、版本與授權，記錄鎖定檔雜湊，並說明 MPL-2.0 的原始碼取得方式', () => {
    const md = renderMarkdown({ entries, ...meta });

    expect(md).toContain('alpha@1.0.0');
    expect(md).toContain('zeta@1.0.0');
    expect(md).toContain('MPL-2.0');
    expect(md).toContain('package-lock.json SHA-256: aaa');
    expect(md).toContain('src-tauri/Cargo.lock SHA-256: bbb');
    expect(md).toMatch(/source code.*available/i);
    expect(md).toContain('Copyright (c) 2020 Alice');
  });

  it('輸入順序不同，輸出完全相同（可重現）', () => {
    expect(renderMarkdown({ entries: [...entries].reverse(), ...meta })).toBe(renderMarkdown({ entries, ...meta }));
  });

  // 專案的 pre-commit 檢查（AGENTS.md 第 16 條）不允許文件含控制字元。授權全文原本有 Tab（縮排），換成四個空格；
  // 空白的寬窄不改變條文，也不影響相同文字的歸組（normalizeText 本來就把空白壓成一個）。
  it('輸出沒有 Tab 等控制字元，只有換行；授權全文裡的 Tab 換成四個空格', () => {
    const tabbed = [{ ...pkg('tabby', 'MIT'), texts: ['MIT License\n\tindented with a tab\n'], synthesized: false }];

    const md = renderMarkdown({ entries: tabbed, ...meta });

    expect(md).toContain('    indented with a tab');
    expect(md).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/);
  });
});

describe('npmProductionPackages', () => {
  it('只取會進到發布 App 的套件（排除 dev 與 devOptional），巢狀路徑取最後一段的套件名', () => {
    const lock = {
      packages: {
        '': { name: 'root' },
        'node_modules/react': { version: '1.0.0' },
        'node_modules/@scope/lib': { version: '2.0.0' },
        'node_modules/a/node_modules/nested': { version: '3.0.0' },
        'node_modules/vitest': { version: '9.9.9', dev: true },
        'node_modules/tool': { version: '8.8.8', devOptional: true },
      },
    };

    expect(npmProductionPackages(lock).map((p: { name: string; version: string }) => `${p.name}@${p.version}`)).toEqual([
      '@scope/lib@2.0.0',
      'nested@3.0.0',
      'react@1.0.0',
    ]);
  });
});

// 守衛：實際的檔案。
describe('專案檔案 (D-10)', () => {
  it('LICENSE 是 MIT，版權人與年份與網站一致', () => {
    const text = readFileSync(join(root, 'LICENSE'), 'utf-8');

    expect(text.startsWith('MIT License')).toBe(true);
    expect(text).toContain('Copyright (c) 2026 CHU YI AN');
    expect(text).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
  });

  it('README 有授權章節，指向 LICENSE 與第三方授權', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf-8');

    expect(readme).toMatch(/^## License$/m);
    expect(readme).toContain('MIT');
    expect(readme).toContain('THIRD-PARTY-LICENSES.md');
  });

  it('THIRD-PARTY-LICENSES.md 記錄的鎖定檔雜湊等於目前的鎖定檔（相依套件變了就會過期，要重新產生）', () => {
    const text = readFileSync(join(root, 'THIRD-PARTY-LICENSES.md'), 'utf-8');

    expect(text).toContain(`package-lock.json SHA-256: ${sha256('package-lock.json')}`);
    expect(text).toContain(`src-tauri/Cargo.lock SHA-256: ${sha256('src-tauri/Cargo.lock')}`);
  });

  it('THIRD-PARTY-LICENSES.md 列出每一個會進到 App 的 npm 套件', () => {
    const text = readFileSync(join(root, 'THIRD-PARTY-LICENSES.md'), 'utf-8');
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf-8'));

    const production = npmProductionPackages(lock);
    expect(production.length).toBeGreaterThan(5);
    for (const p of production) expect(text, `missing ${p.name}@${p.version}`).toContain(`${p.name}@${p.version}`);
  });

  it('THIRD-PARTY-LICENSES.md 沒有 Tab 等控制字元（只有換行），pre-commit 檢查才會放行', () => {
    const text = readFileSync(join(root, 'THIRD-PARTY-LICENSES.md'), 'utf-8');

    expect(text).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/);
  });

  it('NSIS 安裝檔也會把 LICENSE 與 THIRD-PARTY-LICENSES.md 放進安裝資料夾', () => {
    const conf = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf-8'));

    expect(conf.bundle.resources).toEqual({ '../LICENSE': 'LICENSE', '../THIRD-PARTY-LICENSES.md': 'THIRD-PARTY-LICENSES.md' });
  });
});
