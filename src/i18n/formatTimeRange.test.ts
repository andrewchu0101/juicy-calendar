import { describe, expect, it } from 'vitest';
import { formatTimeRange } from './formatTimeRange';

// TC-12｜AC-03.3、FR-10、SRS R-7：區塊上的時間範圍跟隨 Windows 的 12／24 小時設定，與介面語言無關。
// 12 小時制的範圍寫法規格未定；專案擁有者 2026-11-04 同意暫定為「兩端各自用 formatTime、以 – 相接」：
// 英文 `10:30 AM–12:30 PM`、繁體 `上午 10:30–下午 12:30`（同為上午也各自標示）。24 小時制維持 `10:30–12:30`。
// 事件：週一 2026-11-02 10:30–12:30（America/New_York，EST = UTC-5，vitest 的 TZ 同此）。
const event = { startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z' };
const morning = { startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T16:15:00.000Z' }; // 10:30–11:15
const overnight = { startAt: '2026-11-03T04:00:00.000Z', endAt: '2026-11-03T06:00:00.000Z' }; // 23:00–01:00（隔天）

describe('formatTimeRange (TC-12, FR-10, R-7)', () => {
  it.each([
    ['24 小時制，英文', event, 'en', false, '10:30–12:30'],
    ['24 小時制，繁體（與語言無關）', event, 'zh-TW', false, '10:30–12:30'],
    ['12 小時制，英文', event, 'en', true, '10:30 AM–12:30 PM'],
    ['12 小時制，繁體', event, 'zh-TW', true, '上午 10:30–下午 12:30'],
    ['12 小時制，同為上午也各自標示', morning, 'en', true, '10:30 AM–11:15 AM'],
    ['12 小時制，跨午夜', overnight, 'en', true, '11:00 PM–1:00 AM'],
    ['24 小時制，跨午夜', overnight, 'en', false, '23:00–01:00'],
  ] as const)('%s', (_label, range, language, hour12, expected) => {
    expect(formatTimeRange(range, { language, hour12 })).toBe(expected);
  });
});
