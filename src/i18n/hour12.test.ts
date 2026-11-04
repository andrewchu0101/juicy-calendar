import { describe, expect, it } from 'vitest';
import { resolveHour12 } from './hour12';

// TC-12｜FR-10、SDS API-06：`hour12` 以 Rust 回報的 Windows 設定為準；取不到（null）才退回瀏覽器 Intl 的
// `hourCycle`（h11／h12 為 12 小時制，h23／h24 為 24 小時制）。連 Intl 也沒有資訊時維持 24 小時制
// （即票 013 之前的畫面；規格沒寫，列為偏差待確認）。
describe('resolveHour12 (TC-12, FR-10, API-06)', () => {
  it.each([
    [true, 'h23', true],
    [false, 'h12', false],
    [true, undefined, true],
    [false, undefined, false],
  ] as const)('Windows says %s, Intl says %s → %s (Windows wins)', (system, intl, expected) => {
    expect(resolveHour12(system, intl)).toBe(expected);
  });

  it.each([
    ['h12', true],
    ['h11', true],
    ['h23', false],
    ['h24', false],
  ] as const)('Windows unknown, Intl hourCycle %s → %s', (intl, expected) => {
    expect(resolveHour12(null, intl)).toBe(expected);
  });

  it('nothing is known → 24-hour', () => {
    expect(resolveHour12(null, undefined)).toBe(false);
    expect(resolveHour12(null, 'something-new')).toBe(false);
  });
});
