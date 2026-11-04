import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHardcodedText } from '../test-support/hardcodedText';

// TC-11｜FR-09、SDS i18n 契約、票 012 驗收條件 2：元件中沒有殘留寫死的使用者可見文字。
// 檢查方法（專案擁有者 2026-11-04 同意）：解析 src 底下每個非測試的 .tsx，找出 JSX 文字、字串字面值與
// 可見屬性（aria-label、title、placeholder、alt 等）裡的字母文字；產品名稱 Juicy Calendar 除外。

function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return componentFiles(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('the scanner itself (mutation check for TC-11 completeness)', () => {
  it('flags text written straight into a component', () => {
    const bad = `
      export const A = () => (
        <div title="Open it" aria-label={'Close'}>
          Hello
          {open ? 'Confirm' : 'Delete'}
          <input placeholder={\`Name \${n}\`} />
          <span>你好</span>
        </div>
      );`;
    expect(findHardcodedText(bad).map((item) => item.text)).toEqual(
      expect.arrayContaining(['Open it', 'Close', 'Hello', 'Confirm', 'Delete', 'Name', '你好']),
    );
  });

  it('accepts dictionary lookups, symbols, product name and non-visible attributes', () => {
    const good = `
      export const A = () => (
        <div className="flex items-center" data-testid="thing" role="status" title={t('a.b')} aria-label={t('c')}>
          <h1>Juicy Calendar</h1>
          <button>›</button>
          <span>+{count}</span>
          {open ? t('x') : t('y')}
          <i aria-hidden>→</i>
        </div>
      );`;
    expect(findHardcodedText(good)).toEqual([]);
  });
});

describe('no user-visible text is hard-coded in components (TC-11, FR-09)', () => {
  const root = join(process.cwd(), 'src');
  it('src/**/*.tsx has none', () => {
    const found = componentFiles(root).flatMap((file) =>
      findHardcodedText(readFileSync(file, 'utf8'), file).map(
        (item) => `${relative(process.cwd(), file).replaceAll('\\', '/')}:${item.line} ${item.text}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
