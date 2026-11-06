import { describe, expect, it } from 'vitest';
import * as engine from './index';

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

// TC-18｜框與區塊矩形相交（AC-04.1、FR-12、R-9）。預期值是人工算的座標，不呼叫實作當答案。
describe('TC-18a marquee rectangle', () => {
  it('rectFromPoints orders the corners whatever the drag direction', () => {
    expect(engine.rectFromPoints({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual(rect(10, 20, 50, 80));
  });

  it('rectsIntersect is true when the rectangles overlap, even only a little', () => {
    expect(engine.rectsIntersect(rect(0, 0, 100, 100), rect(99, 99, 200, 200))).toBe(true);
    expect(engine.rectsIntersect(rect(0, 0, 100, 100), rect(20, 20, 30, 30))).toBe(true);
  });

  it('rectsIntersect is false when they only miss by a pixel', () => {
    expect(engine.rectsIntersect(rect(0, 0, 100, 100), rect(101, 0, 200, 100))).toBe(false);
    expect(engine.rectsIntersect(rect(0, 0, 100, 100), rect(0, 101, 100, 200))).toBe(false);
  });

  it('rectsIntersect counts touching edges as touching', () => {
    expect(engine.rectsIntersect(rect(0, 0, 100, 100), rect(100, 0, 200, 100))).toBe(true);
  });
});

// TC-18b｜整批位移（AC-04.2、FR-13、R-9）。算例：A 週一 10:00–12:00、B 週二 14:00–15:30，A 被抓住並移到週一 11:15。
// 時差 +75 分鐘 → A 11:15–13:15、B 15:15–16:45；長度各自不變。
describe('TC-18b moving selected events together', () => {
  const group = {
    a: { startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z' },
    b: { startAt: '2026-11-03T19:00:00.000Z', endAt: '2026-11-03T20:30:00.000Z' },
  };

  it('shifts every event by the grabbed event\'s time difference and keeps each length', () => {
    const moved = engine.moveEventsTogether(group, 'a', { startAt: '2026-11-02T16:15:00.000Z', endAt: '2026-11-02T18:15:00.000Z' });
    expect(moved).toEqual({
      a: { startAt: '2026-11-02T16:15:00.000Z', endAt: '2026-11-02T18:15:00.000Z' },
      b: { startAt: '2026-11-03T20:15:00.000Z', endAt: '2026-11-03T21:45:00.000Z' },
    });
  });

  it('keeps the gap between events when the group crosses into another day', () => {
    const moved = engine.moveEventsTogether(group, 'b', { startAt: '2026-11-04T19:00:00.000Z', endAt: '2026-11-04T20:30:00.000Z' });
    expect(moved.a).toEqual({ startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-03T17:00:00.000Z' });
    expect(moved.b).toEqual({ startAt: '2026-11-04T19:00:00.000Z', endAt: '2026-11-04T20:30:00.000Z' });
  });

  it('is a no-op shift when the grabbed event did not move', () => {
    expect(engine.moveEventsTogether(group, 'a', group.a)).toEqual(group);
  });
});
