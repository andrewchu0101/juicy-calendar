import { describe, expect, it } from 'vitest';
import {
  columnIndexAt,
  magnetMinutes,
  radialBalls,
  radialHit,
  radialRing,
  radialStep,
  durationMinutes,
  edgeScrollSpeed,
  formatDuration,
  hiddenEventCounts,
  hourMarks,
  layoutSegments,
  minutesFromColumnStart,
  MIN_SEGMENT_HEIGHT,
  moveEvent,
  newEventTimes,
  pointerToTime,
  resizeEnd,
  resizeStart,
  shiftAnchor,
  timelineSpanMinutes,
  visibleDays,
  withDate,
  withDuration,
  withEndTime,
  withStartTime,
  type GridGeometry,
  type TimelineConfig,
} from './index';

const fullDay: TimelineConfig = { startHour: 0, endHour: 24, pixelsPerMinute: 1 };
const overnight: TimelineConfig = { startHour: 8, endHour: 3, pixelsPerMinute: 2 };
const monday = new Date(2026, 10, 2);
const week = visibleDays('week', monday);
const geometry: GridGeometry = { left: 100, top: 50, columnWidth: 100, columnCount: 7 };

const event = (id: string, start: Date, end: Date) => ({
  id,
  startAt: start.toISOString(),
  endAt: end.toISOString(),
});
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);

describe('timeline', () => {
  it('computes spans, including overnight and 24h timelines', () => {
    expect(timelineSpanMinutes(fullDay)).toBe(1440);
    expect(timelineSpanMinutes({ ...fullDay, startHour: 8, endHour: 22 })).toBe(840);
    expect(timelineSpanMinutes(overnight)).toBe(1140);
    expect(timelineSpanMinutes({ ...fullDay, startHour: 6, endHour: 6 })).toBe(1440);
  });

  it('flags hour marks that fall on the next day', () => {
    const marks = hourMarks(overnight);
    expect(marks[0]).toMatchObject({ label: '08:00', nextDay: false });
    expect(marks.find((mark) => mark.hour === 0)?.nextDay).toBe(true);
    expect(marks).toHaveLength(19);
  });

  it('builds a Monday-first week and navigates by period', () => {
    expect(week).toHaveLength(7);
    expect(week[0]?.getDay()).toBe(1);
    expect(visibleDays('week', at(8, 12))[0]).toEqual(monday);
    expect(visibleDays('day', at(4, 12))).toEqual([new Date(2026, 10, 4)]);
    expect(shiftAnchor('week', monday, 1)).toEqual(new Date(2026, 10, 9));
    expect(shiftAnchor('day', monday, -1)).toEqual(new Date(2026, 10, 1));
  });
});

describe('pointer conversion', () => {
  it('maps a pointer to the exact column and minute', () => {
    const time = pointerToTime({ x: 150, y: 50 + 630 }, geometry, week, fullDay);
    expect(time).toEqual(at(2, 10, 30));
    expect(pointerToTime({ x: 350, y: 50 + 61 }, geometry, week, fullDay)).toEqual(at(4, 1, 1));
  });

  it('honours zoom and timeline start', () => {
    expect(pointerToTime({ x: 150, y: 50 + 120 }, geometry, week, overnight)).toEqual(at(2, 9));
  });

  it('resolves below midnight on an overnight timeline to the next date', () => {
    const y = 50 + (17 * 60 + 30) * 2; // 08:00 + 17.5h = 01:30 next day
    expect(pointerToTime({ x: 150, y }, geometry, week, overnight)).toEqual(at(3, 1, 30));
  });

  it('clamps by default, and can overflow past the column for resizing', () => {
    expect(pointerToTime({ x: 150, y: -500 }, geometry, week, fullDay)).toEqual(at(2, 0));
    expect(pointerToTime({ x: 150, y: 50 + 1500 }, geometry, week, fullDay)).toEqual(at(3, 0));
    expect(pointerToTime({ x: 150, y: 50 + 1500 }, geometry, week, fullDay, { allowOverflow: true })).toEqual(
      at(3, 1),
    );
  });

  it('clamps out-of-range columns', () => {
    expect(columnIndexAt(0, geometry)).toBe(0);
    expect(columnIndexAt(5000, geometry)).toBe(6);
  });

  it('accelerates scrolling only near an edge', () => {
    expect(edgeScrollSpeed(300, 0, 600)).toBe(0);
    expect(edgeScrollSpeed(0, 0, 600)).toBe(-14);
    expect(edgeScrollSpeed(600, 0, 600)).toBe(14);
  });
});

describe('mutations', () => {
  const base = event('a', at(2, 10, 30), at(2, 12, 30));

  it('creates exactly 120 minutes', () => {
    const created = newEventTimes(at(2, 10, 30));
    expect(durationMinutes(created)).toBe(120);
    expect(new Date(created.endAt)).toEqual(at(2, 12, 30));
  });

  it('moves across dates and preserves duration', () => {
    const moved = moveEvent(base, at(5, 15), 30 * 60_000);
    expect(new Date(moved.startAt)).toEqual(at(5, 14, 30));
    expect(durationMinutes(moved)).toBe(120);
  });

  it('resizes only the dragged endpoint', () => {
    const top = resizeStart(base, at(2, 9, 17));
    expect(new Date(top.startAt)).toEqual(at(2, 9, 17));
    expect(top.endAt).toBe(base.endAt);
    const bottom = resizeEnd(base, at(2, 13, 3));
    expect(bottom.startAt).toBe(base.startAt);
    expect(new Date(bottom.endAt)).toEqual(at(2, 13, 3));
  });

  it('never inverts an event and supports cross-midnight resizing', () => {
    expect(durationMinutes(resizeStart(base, at(3, 9)))).toBe(1);
    expect(durationMinutes(resizeEnd(base, at(1, 9)))).toBe(1);
    expect(new Date(resizeEnd(base, at(3, 1)).endAt)).toEqual(at(3, 1));
  });

  it('applies inspector edits', () => {
    expect(new Date(withDate(base, '2026-11-20')!.startAt)).toEqual(at(20, 10, 30));
    expect(durationMinutes(withDate(base, '2026-11-20')!)).toBe(120);
    expect(new Date(withStartTime(base, '08:15')!.endAt)).toEqual(at(2, 10, 15));
    expect(new Date(withEndTime(base, '11:00')!.endAt)).toEqual(at(2, 11));
    // 票 004：早於開始的結束時間不再當成隔天（SRS R-3、PRD Q-04；舊期待為 at(3, 1)）
    expect(withEndTime(base, '01:00')).toBeNull();
    expect(durationMinutes(withDuration(base, 45)!)).toBe(45);
  });

  it('keeps a multi-day end date when editing the end time', () => {
    const long = event('l', at(2, 10), at(4, 10));
    expect(new Date(withEndTime(long, '12:00')!.endAt)).toEqual(at(4, 12));
  });

  it('rejects invalid inspector input', () => {
    expect(withDate(base, 'nope')).toBeNull();
    expect(withStartTime(base, '25:00')).toBeNull();
    expect(withEndTime(base, '')).toBeNull();
    expect(withDuration(base, 0)).toBeNull();
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(135)).toBe('2h 15m');
  });
});

describe('layout', () => {
  it('positions by minutes and pixels-per-minute', () => {
    const [segment] = layoutSegments([event('a', at(2, 10), at(2, 12))], week, {
      ...fullDay,
      pixelsPerMinute: 1.5,
    });
    expect(segment).toMatchObject({ columnIndex: 0, top: 900, height: 180, isStart: true, isEnd: true });
  });

  it('splits a cross-midnight event across columns on a 24h timeline', () => {
    const segments = layoutSegments([event('a', at(2, 23), at(3, 1))], week, fullDay);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ columnIndex: 0, top: 1380, height: 60, isStart: true, isEnd: false });
    expect(segments[1]).toMatchObject({ columnIndex: 1, top: 0, height: 60, isStart: false, isEnd: true });
  });

  it('keeps a cross-midnight event whole on an overnight timeline', () => {
    const segments = layoutSegments([event('a', at(2, 23), at(3, 1))], week, overnight);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ columnIndex: 0, top: 900 * 2, height: 240, isStart: true, isEnd: true });
  });

  it('clips events past the timeline and removes the clipped handle', () => {
    const timeline = { ...fullDay, startHour: 8, endHour: 20 };
    const [segment] = layoutSegments([event('a', at(2, 19), at(2, 22))], week, timeline);
    expect(segment).toMatchObject({ top: 660, height: 60, isStart: true, isEnd: false });
  });

  it('counts events the timeline hides on their date', () => {
    const timeline = { ...fullDay, startHour: 8, endHour: 20 };
    const hidden = event('a', at(3, 2), at(3, 3));
    expect(layoutSegments([hidden], week, timeline)).toHaveLength(0);
    expect(hiddenEventCounts([hidden], week, timeline)).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });

  it('gives overlaps separate lanes without changing times', () => {
    const segments = layoutSegments(
      [event('a', at(2, 10), at(2, 12)), event('b', at(2, 11), at(2, 13)), event('c', at(2, 12), at(2, 14))],
      week,
      fullDay,
    );
    const lanes = Object.fromEntries(segments.map((s) => [s.eventId, s]));
    expect(lanes.a).toMatchObject({ lane: 0, laneCount: 2 });
    expect(lanes.b).toMatchObject({ lane: 1, laneCount: 2 });
    expect(lanes.c).toMatchObject({ lane: 0, laneCount: 2 });
  });

  it('does not share lanes between separate clusters', () => {
    const segments = layoutSegments([event('a', at(2, 8), at(2, 9)), event('b', at(2, 10), at(2, 11))], week, fullDay);
    expect(segments.every((s) => s.lane === 0 && s.laneCount === 1)).toBe(true);
  });

  it('keeps very short events visible, also at the bottom edge', () => {
    const [short] = layoutSegments([event('a', at(2, 10), at(2, 10, 1))], week, fullDay);
    expect(short?.height).toBe(MIN_SEGMENT_HEIGHT);
    const [edge] = layoutSegments([event('b', new Date(2026, 10, 2, 23, 59), at(3, 0))], week, fullDay);
    expect((edge?.top ?? 0) + (edge?.height ?? 0)).toBeLessThanOrEqual(1440);
  });

  it('spreads a very long event over every column it touches', () => {
    const segments = layoutSegments([event('a', at(1, 12), at(20, 12))], week, fullDay);
    expect(segments).toHaveLength(7);
    expect(segments.every((s) => s.height === 1440 && !s.isStart && !s.isEnd)).toBe(true);
  });

  it('gives the same result for a date in week and day views', () => {
    const data = [event('a', at(4, 10), at(4, 12))];
    const weekly = layoutSegments(data, week, fullDay)[0];
    const daily = layoutSegments(data, visibleDays('day', at(4, 0)), fullDay)[0];
    expect(weekly?.columnIndex).toBe(2);
    expect(daily?.columnIndex).toBe(0);
    expect(daily?.top).toBe(weekly?.top);
    expect(daily?.height).toBe(weekly?.height);
  });
});

// vitest.config.ts pins TZ to America/New_York. 2026 DST: Mar 8 forward, Nov 1 back.
describe('daylight saving', () => {
  it('runs in a timezone that has DST', () => {
    expect(new Date(2026, 2, 7).getTimezoneOffset()).not.toBe(new Date(2026, 2, 9).getTimezoneOffset());
  });

  it('new events are 120 elapsed minutes across spring-forward', () => {
    const created = newEventTimes(new Date(2026, 2, 8, 1, 30));
    expect(durationMinutes(created)).toBe(120);
    expect(new Date(created.endAt).getHours()).toBe(4);
  });

  it('draws events by wall clock so they stay aligned with hour labels', () => {
    const day = new Date(2026, 2, 8);
    expect(minutesFromColumnStart(new Date(2026, 2, 8, 12), day, fullDay)).toBe(720);
    const [segment] = layoutSegments(
      [event('a', new Date(2026, 2, 8, 1, 30), new Date(2026, 2, 8, 3, 30))],
      [day],
      fullDay,
    );
    expect(segment).toMatchObject({ top: 90, height: 120 });
  });

  it('preserves elapsed duration when moving across a DST boundary', () => {
    const before = event('a', new Date(2026, 2, 7, 22), new Date(2026, 2, 8, 0));
    const moved = moveEvent(before, new Date(2026, 2, 8, 1), 0);
    expect(durationMinutes(moved)).toBe(120);
  });

  it('renders an event inside the repeated fall-back hour', () => {
    const start = new Date('2026-11-01T05:50:00Z'); // 01:50 EDT
    const end = new Date('2026-11-01T06:10:00Z'); // 01:10 EST: earlier on the wall clock
    expect(durationMinutes(event('a', start, end))).toBe(20);
    const [segment] = layoutSegments([event('a', start, end)], [new Date(2026, 10, 1)], fullDay);
    expect(segment?.height).toBeGreaterThanOrEqual(MIN_SEGMENT_HEIGHT);
  });
});


describe('gesture geometry', () => {
  it('only attracts inside eight pixels and can be disabled', () => {
    expect(magnetMinutes(26, 1, true)).toBe(30);
    expect(magnetMinutes(21, 1, true)).toBe(21);
    expect(magnetMinutes(26, 3, true)).toBe(26);
    expect(magnetMinutes(26, 1, false)).toBe(26);
    expect(magnetMinutes(-4, 1, true)).toBe(-0);
  });
  it('keeps radial targets on screen and only selects inside a ball', () => {
    const balls = radialBalls({ x: 1, y: 1 }, 6, 1400, 900);
    expect(balls.every(ball => ball.x >= 28 && ball.y >= 28)).toBe(true);
    expect(radialHit(balls[2]!, balls)).toBe(2);
    expect(radialHit({ x: 1200, y: 700 }, balls)).toBe(-1);
  });
  // TC-16（提案編號，待併入 docs/06-test-plan.md）｜AC-01.4、FR-04｜票 020
  it('TC-16a hovering a radial ball only hovers it: nothing is picked yet', () => {
    const balls = radialBalls({ x: 700, y: 450 }, 6, 1400, 900);
    expect(radialStep(-1, balls[2]!, balls, radialRing({ x: 700, y: 450 }, 6, 1400, 900))).toEqual({ hovered: 2, picked: null });
  });
  it('TC-16b leaving the hovered ball picks it', () => {
    const balls = radialBalls({ x: 700, y: 450 }, 6, 1400, 900);
    const outside = { x: balls[2]!.x + 40, y: balls[2]!.y + 40 };
    expect(radialHit(outside, balls)).toBe(-1);
    expect(radialStep(2, outside, balls, radialRing({ x: 700, y: 450 }, 6, 1400, 900))).toEqual({ hovered: -1, picked: 2 });
  });
  it('TC-16c moving straight onto a neighbouring ball only switches the hover', () => {
    const balls = [{ x: 100, y: 100 }, { x: 140, y: 100 }];
    // x=128 is inside both hit circles (28 px) but nearer to ball 1.
    expect(radialStep(0, { x: 128, y: 100 }, balls, { center: { x: 120, y: 300 }, radius: 76 })).toEqual({ hovered: 1, picked: null });
  });
  it('TC-16e returning from a hovered ball to the ring centre cancels the hover without picking', () => {
    const origin = { x: 700, y: 450 };
    const balls = radialBalls(origin, 6, 1400, 900);
    const ring = radialRing(origin, 6, 1400, 900);
    expect(radialStep(2, ring.center, balls, ring)).toEqual({ hovered: -1, picked: null });
    // The centre is an 80 px circle. Probe between two balls so no ball hit circle is involved.
    const between = (radius: number) => ({ x: ring.center.x + Math.cos(-Math.PI / 3) * radius, y: ring.center.y + Math.sin(-Math.PI / 3) * radius });
    expect(radialHit(between(79), balls)).toBe(-1);
    expect(radialStep(0, between(79), balls, ring)).toEqual({ hovered: -1, picked: null });
    expect(radialHit(between(81), balls)).toBe(-1);
    expect(radialStep(0, between(81), balls, ring)).toEqual({ hovered: -1, picked: 0 });
  });
  it('TC-16f leaving outward past the ring still picks the hovered ball', () => {
    const origin = { x: 700, y: 450 };
    const balls = radialBalls(origin, 6, 1400, 900);
    const ring = radialRing(origin, 6, 1400, 900);
    const outward = { x: balls[0]!.x, y: balls[0]!.y - 45 };
    expect(radialStep(0, outward, balls, ring)).toEqual({ hovered: -1, picked: 0 });
  });
  it('TC-16d leaving empty space without ever hovering a ball picks nothing', () => {
    const balls = radialBalls({ x: 700, y: 450 }, 6, 1400, 900);
    expect(radialStep(-1, { x: 5, y: 5 }, balls, radialRing({ x: 700, y: 450 }, 6, 1400, 900))).toEqual({ hovered: -1, picked: null });
  });
});
