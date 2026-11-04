import { describe, expect, it } from 'vitest';
import { hiddenEventsTitle } from './hiddenEventsTitle';

// TC-11｜FR-09、票 011：日期欄位 `+N` 徽章的說明文字。英文依數量用單數或複數（與票 011 之前相同：
// 1 → `1 event…`，其餘 → `N events…`）；中文沒有單複數，兩者句型相同。預期值為字面文字。
describe('hiddenEventsTitle (TC-11, FR-09)', () => {
  it.each([
    ['en', 1, '1 event outside the visible hours'],
    ['en', 2, '2 events outside the visible hours'],
    ['en', 12, '12 events outside the visible hours'],
    ['zh-TW', 1, '有 1 個事件在可見時段之外'],
    ['zh-TW', 2, '有 2 個事件在可見時段之外'],
  ] as const)('%s, %i hidden → %s', (language, count, expected) => {
    expect(hiddenEventsTitle(language, count)).toBe(expected);
  });
});
