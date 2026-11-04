import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

// TC-12｜AC-03.3、FR-10、SRS R-7、SDS formatTime 列：時間格式只跟 Windows 的 12/24 小時走，與介面語言無關；
// 12 小時制的寫法依語言：英文 `1:05 PM`、繁體 `下午 1:05`。預期值逐字取自測試計畫 TC-12，不呼叫實作推算。
// 日期用本地時間建構（2026-11-02）。午夜與正午的繁體寫法為規格暫定，不阻塞。
const at = (hour: number, minute: number) => new Date(2026, 10, 2, hour, minute);

describe('formatTime (TC-12, FR-10, R-7)', () => {
  it.each([
    // [說明, 時, 分, 語言, hour12, 預期]
    ['13:05 24 小時制，英文', 13, 5, 'en', false, '13:05'],
    ['13:05 24 小時制，繁體', 13, 5, 'zh-TW', false, '13:05'],
    ['13:05 12 小時制，英文', 13, 5, 'en', true, '1:05 PM'],
    ['13:05 12 小時制，繁體', 13, 5, 'zh-TW', true, '下午 1:05'],
    ['午夜 24 小時制', 0, 0, 'en', false, '00:00'],
    ['午夜 12 小時制，英文', 0, 0, 'en', true, '12:00 AM'],
    ['午夜 12 小時制，繁體（暫定）', 0, 0, 'zh-TW', true, '上午 12:00'],
    ['正午 24 小時制', 12, 0, 'en', false, '12:00'],
    ['正午 12 小時制，英文', 12, 0, 'en', true, '12:00 PM'],
    ['正午 12 小時制，繁體（暫定）', 12, 0, 'zh-TW', true, '下午 12:00'],
    ['上午 9:07 12 小時制，英文（分鐘補零、小時不補零）', 9, 7, 'en', true, '9:07 AM'],
    ['上午 9:07 12 小時制，繁體', 9, 7, 'zh-TW', true, '上午 9:07'],
    ['23:59 12 小時制，英文', 23, 59, 'en', true, '11:59 PM'],
    ['09:07 24 小時制補零', 9, 7, 'en', false, '09:07'],
  ] as const)('%s', (_label, hour, minute, language, hour12, expected) => {
    expect(formatTime(at(hour, minute), { language, hour12 })).toBe(expected);
  });
});
