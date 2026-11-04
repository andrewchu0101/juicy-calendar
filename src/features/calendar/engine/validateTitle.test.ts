import { describe, expect, it } from 'vitest';
import { validateTitle } from './index';

// 預期值全部來自 docs/06-test-plan.md TC-03 與 SRS R-3，不呼叫實作當答案。
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}'; // 👨‍👩‍👧：一個使用者看到的字元，多個 code point

describe('[TC-03][AC-01.3,FR-02,R-3] validateTitle：去空白、非空、不超過 30 個使用者看到的字元', () => {
  it.each([
    ['空字串', ''],
    ['全空白', '   '],
    ['tab 與換行', '\t\n '],
  ])('拒絕：%s', (_name, raw) => {
    expect(validateTitle(raw)).toBeNull();
  });

  it('去掉前後空白後存檔：「  寫 PRD  」→「寫 PRD」', () => {
    expect(validateTitle('  寫 PRD  ')).toBe('寫 PRD');
  });

  it.each([
    ['30 個中文字', '字'.repeat(30)],
    ['30 個英文字母', 'a'.repeat(30)],
    ['30 個 👨‍👩‍👧', FAMILY.repeat(30)],
  ])('接受：%s', (_name, raw) => {
    expect(validateTitle(raw)).toBe(raw);
  });

  it('接受：30 個字後再加兩個空白（去空白後 30 字），存成 30 字', () => {
    expect(validateTitle(`${'字'.repeat(30)}  `)).toBe('字'.repeat(30));
  });

  it.each([
    ['31 個中文字', '字'.repeat(31)],
    ['31 個英文字母', 'a'.repeat(31)],
    ['31 個 👨‍👩‍👧', FAMILY.repeat(31)],
  ])('拒絕：%s', (_name, raw) => {
    expect(validateTitle(raw)).toBeNull();
  });
});
