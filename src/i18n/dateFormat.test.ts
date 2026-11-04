import { describe, expect, it } from 'vitest';
import { formatDate } from './dateFormat';

// TC-11｜FR-09、SRS R-7、SDS formatTime 列：星期與月份用 date-fns 的 zh-TW／en-US 語系。
// 預期值來自人工算例：2026-11-09 是星期一（2026-11-01 是星期日，再加 8 天）；
// 2026-11-15 是星期日。月份 11 月。測試不呼叫 formatDate 以外的實作當答案。
const monday = new Date(2026, 10, 9);
const sunday = new Date(2026, 10, 15);

describe('formatDate weekday and month names follow the language (TC-11, FR-09, R-7)', () => {
  it.each([
    ['EEE', monday, 'zh-TW', '週一'],
    ['EEE', sunday, 'zh-TW', '週日'],
    ['EEEE', monday, 'zh-TW', '星期一'],
    ['MMM', monday, 'zh-TW', '11月'],
    ['EEE', monday, 'en', 'Mon'],
    ['EEE', sunday, 'en', 'Sun'],
    ['EEEE', monday, 'en', 'Monday'],
    ['MMM', monday, 'en', 'Nov'],
    ['MMMM', monday, 'en', 'November'],
  ] as const)('%s of %s in %s → %s', (pattern, date, language, expected) => {
    expect(formatDate(date, pattern, language)).toBe(expected);
  });

  it('numbers and punctuation do not depend on the language', () => {
    expect(formatDate(monday, 'd', 'zh-TW')).toBe('9');
    expect(formatDate(monday, 'yyyy', 'zh-TW')).toBe('2026');
  });
});
