import { describe, expect, it } from 'vitest';

import { resizeEnd, resizeStart } from './index';

// 事件：週一 2026-11-02 10:30–12:30（America/New_York，EST = UTC-5）
const monday = { startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z' };

describe('TC-05 拖曳邊緣上下限（FR-02、SRS R-3、U-04）', () => {
  it('下緣拖到 09:00：結束夾在開始 + 1 分鐘，開始不變', () => {
    const result = resizeEnd(monday, new Date('2026-11-02T14:00:00Z')); // 09:00 EST
    expect(result).toEqual({ startAt: monday.startAt, endAt: '2026-11-02T15:31:00.000Z' });
  });

  it('上緣拖到 13:00：開始夾在結束 - 1 分鐘，結束不變', () => {
    const result = resizeStart(monday, new Date('2026-11-02T18:00:00Z')); // 13:00 EST
    expect(result).toEqual({ startAt: '2026-11-02T17:29:00.000Z', endAt: monday.endAt });
  });

  it('下緣拖到很遠：長度停在 10080 分鐘', () => {
    const result = resizeEnd(monday, new Date('2027-03-01T00:00:00Z'));
    expect(result).toEqual({ startAt: monday.startAt, endAt: '2026-11-09T15:30:00.000Z' });
  });

  it('上緣拖到很遠：長度停在 10080 分鐘（經過時間，跨夏令結束日）', () => {
    const result = resizeStart(monday, new Date('2026-01-01T00:00:00Z'));
    expect(result).toEqual({ startAt: '2026-10-26T17:30:00.000Z', endAt: monday.endAt });
  });
});
