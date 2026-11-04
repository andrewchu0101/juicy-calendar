import { describe, expect, it } from 'vitest';
import { rangeLabel } from './rangeLabel';

// TC-11｜FR-09、SRS R-7：日曆標題的日期範圍依語言輸出。
// 英文預期值 = 現有畫面的寫法（e2e 的 'Nov 9 – 15, 2026'）；中文寫法已由專案擁有者確認（2026-11-04）：
//   單日 `2026年11月9日 星期一`；同月 `2026年11月9日 – 15日`；跨月 `2026年11月30日 – 12月6日`。
// 日期的人工算例：2026-11-09 是星期一；2026-11-30 是星期一；2026-12-28 是星期一；2027-01-03 是星期日。
const run = (year: number, month: number, day: number, length: number) =>
  Array.from({ length }, (_, offset) => new Date(year, month - 1, day + offset));

describe('rangeLabel (TC-11, FR-09, R-7)', () => {
  it.each([
    ['en', 'one day', run(2026, 11, 9, 1), 'Monday, November 9, 2026'],
    ['en', 'a week in one month', run(2026, 11, 9, 7), 'Nov 9 – 15, 2026'],
    ['en', 'a week across two months', run(2026, 11, 30, 7), 'Nov 30 – Dec 6, 2026'],
    ['en', 'a week across two years', run(2026, 12, 28, 7), 'Dec 28 – Jan 3, 2027'],
    ['zh-TW', 'one day', run(2026, 11, 9, 1), '2026年11月9日 星期一'],
    ['zh-TW', 'a week in one month', run(2026, 11, 9, 7), '2026年11月9日 – 15日'],
    ['zh-TW', 'a week across two months', run(2026, 11, 30, 7), '2026年11月30日 – 12月6日'],
    ['zh-TW', 'a week across two years', run(2026, 12, 28, 7), '12月28日 – 2027年1月3日'],
  ] as const)('%s, %s', (language, _name, days, expected) => {
    expect(rangeLabel([...days], language)).toBe(expected);
  });

  it.each(['en', 'zh-TW'] as const)('no days → empty text (%s)', (language) => {
    expect(rangeLabel([], language)).toBe('');
  });
});
