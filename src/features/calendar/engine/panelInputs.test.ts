import { describe, expect, it } from 'vitest';
import { durationMinutes, withDate, withDuration, withEndTime, withStartTime } from './index';

// TC-04｜面板輸入邊界（FR-03、Q-04，SRS R-3）。時區由 vitest.config.ts 固定為 America/New_York。
// 事件為週一 2026-11-02 10:30–12:30（15:30Z–17:30Z）。拒絕＝回傳 null，呼叫端據此還原欄位、不寫檔。
const iso = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
const base = { startAt: iso(2, 10, 30), endAt: iso(2, 12, 30) };
const overnight = { startAt: iso(2, 23), endAt: iso(3, 1) };

describe('[TC-04][FR-03,Q-04] inspector end time', () => {
  it.each(['10:30', '09:00'])('rejects %s: not after the start, and no longer read as next day', (time) => {
    expect(withEndTime(base, time)).toBeNull();
  });

  it('accepts 10:31 as a 1 minute event', () => {
    expect(durationMinutes(withEndTime(base, '10:31')!)).toBe(1);
  });

  it('accepts 23:59 as an 809 minute event', () => {
    expect(durationMinutes(withEndTime(base, '23:59')!)).toBe(809);
  });

  it.each(['24:00', '9:5', '', 'abc'])('rejects the malformed time %j', (time) => {
    expect(withEndTime(base, time)).toBeNull();
  });

  it('applies the time to the date the event currently ends on (overnight event)', () => {
    expect(withEndTime(overnight, '02:00')).toEqual({ startAt: overnight.startAt, endAt: iso(3, 2) });
    expect(durationMinutes(withEndTime(overnight, '02:00')!)).toBe(180);
    expect(withEndTime(overnight, '22:00')).toEqual({ startAt: overnight.startAt, endAt: iso(3, 22) });
    expect(durationMinutes(withEndTime(overnight, '22:00')!)).toBe(1380);
    expect(withEndTime(overnight, '23:00')).toEqual({ startAt: overnight.startAt, endAt: iso(3, 23) });
    expect(durationMinutes(withEndTime(overnight, '23:00')!)).toBe(1440);
  });

  it('rejects an end that would make the event longer than 10080 minutes (SRS R-3)', () => {
    const sevenDays = { startAt: iso(2, 10, 30), endAt: iso(9, 10, 30) };
    expect(durationMinutes(withEndTime(sevenDays, '10:29')!)).toBe(10079);
    expect(withEndTime(sevenDays, '10:31')).toBeNull();
  });
});

describe('[TC-04][FR-03,Q-04] inspector duration', () => {
  it.each([0, 0.4, Number.NaN, -5])('rejects %s', (minutes) => {
    expect(withDuration(base, minutes)).toBeNull();
  });

  it.each([
    [1, 1],
    [1.4, 1],
    [1.5, 2],
  ])('accepts %s and stores %s minute(s)', (input, stored) => {
    expect(durationMinutes(withDuration(base, input)!)).toBe(stored);
  });

  it('accepts 900 minutes, ending 2026-11-03T06:30:00Z', () => {
    expect(withDuration(base, 900)).toEqual({ startAt: base.startAt, endAt: '2026-11-03T06:30:00.000Z' });
  });

  it('accepts 10080 minutes, ending 2026-11-09T15:30:00Z', () => {
    expect(withDuration(base, 10080)).toEqual({ startAt: base.startAt, endAt: '2026-11-09T15:30:00.000Z' });
  });

  it.each([10081, 10080.4, 1e12, Number.POSITIVE_INFINITY])('rejects %s (judged on the input, before rounding)', (minutes) => {
    expect(withDuration(base, minutes)).toBeNull();
  });
});

describe('[TC-04][FR-03,Q-04] inspector start time', () => {
  it('accepts 09:15 and keeps the 120 minute length', () => {
    const result = withStartTime(base, '09:15')!;
    expect(result).toEqual({ startAt: iso(2, 9, 15), endAt: iso(2, 11, 15) });
  });

  it.each(['25:00', '09:60', '9:5', ''])('rejects the malformed time %j', (time) => {
    expect(withStartTime(base, time)).toBeNull();
  });
});

describe('[TC-04][FR-03,Q-04] inspector date', () => {
  it('accepts 2026-11-03 and moves the whole event to Tuesday', () => {
    expect(withDate(base, '2026-11-03')).toEqual({ startAt: '2026-11-03T15:30:00.000Z', endAt: '2026-11-03T17:30:00.000Z' });
  });

  it.each(['2026-02-30', '2026-11-31', '2026-13-01', '2027-02-29', '2026-00-10', 'nope', '2026-1-3', ''])(
    'rejects %j: not an existing date (no rolling over to the next month)',
    (date) => {
      expect(withDate(base, date)).toBeNull();
    },
  );

  it('accepts a real leap day', () => {
    expect(withDate(base, '2028-02-29')).not.toBeNull();
  });
});
