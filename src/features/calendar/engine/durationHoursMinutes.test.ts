import { describe, expect, it } from 'vitest';
import { durationMinutes, withDuration, withHoursMinutes } from './index';

// TC-04 延伸（票 021）｜面板持續時間「小時＋分鐘」兩欄（FR-03，SRS R-3）。時區由 vitest.config.ts 固定為 America/New_York。
// 事件為週一 2026-11-02 10:30–12:30。預期值來自 SRS R-3 邊界例的人工算例，不呼叫實作當答案。
const iso = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
const base = { startAt: iso(2, 10, 30), endAt: iso(2, 12, 30) };

describe('[TC-04][FR-03,R-3] inspector duration: hours + minutes fields', () => {
  it('converts hours and minutes to the same end time as the minutes-only input', () => {
    // 2 小時 30 分 ＝ 0 小時 150 分 ＝ 150 分鐘 → 結束 13:00
    const expected = { startAt: base.startAt, endAt: iso(2, 13, 0) };
    expect(withHoursMinutes(base, '2', '30')).toEqual(expected);
    expect(withHoursMinutes(base, '0', '150')).toEqual(expected);
    expect(withDuration(base, 150)).toEqual(expected);
    expect(durationMinutes(withHoursMinutes(base, '2', '30')!)).toBe(150);
  });

  it('accepts 1 hour 90 minutes as 150 minutes (minutes over 59 convert directly)', () => {
    expect(durationMinutes(withHoursMinutes(base, '1', '90')!)).toBe(150);
  });

  // 行為 2：小時欄只收非負整數。1.5／-1／abc 的總分鐘（90、-60+30…）有些落在範圍內，所以必須由小時欄自己擋。
  it.each(['1.5', '-1', 'abc', '1e1', '0x2', 'Infinity'])('rejects the hours field %j', (hours) => {
    expect(withHoursMinutes(base, hours, '30')).toBeNull();
  });
  it('rejects hours 1.5 even when the total (90 min) is in range', () => {
    expect(withHoursMinutes(base, '1.5', '0')).toBeNull();
  });

  // 行為 3：空白規則
  it('treats a blank minutes field as 0 (15 hours → ends next day 01:30)', () => {
    expect(withHoursMinutes(base, '15', '')).toEqual({ startAt: base.startAt, endAt: '2026-11-03T06:30:00.000Z' });
  });
  it('treats a blank hours field as 0 (0 hours 900 minutes ↔ blank hours 900 minutes)', () => {
    expect(withHoursMinutes(base, '', '900')).toEqual({ startAt: base.startAt, endAt: '2026-11-03T06:30:00.000Z' });
    expect(withHoursMinutes(base, '0', '900')).toEqual({ startAt: base.startAt, endAt: '2026-11-03T06:30:00.000Z' });
  });
  it.each([
    ['', ''],
    ['  ', ' '],
  ])('rejects both fields blank (%j, %j)', (hours, minutes) => {
    expect(withHoursMinutes(base, hours, minutes)).toBeNull();
  });

  // 行為 4：分鐘欄驗證與範圍（輸入值判斷，通過後才四捨五入）
  it.each(['abc', '-1', 'Infinity', '1e12', '0/0', '0x10', '0b11'])('rejects the minutes field %j', (minutes) => {
    expect(withHoursMinutes(base, '0', minutes)).toBeNull();
  });
  it('rejects -30 minutes even though 2 hours would bring the total into range', () => {
    expect(withHoursMinutes(base, '2', '-30')).toBeNull();
  });
  it.each([
    ['0', '1', 1],
    ['0', '1.4', 1],
    ['0', '1.5', 2],
    ['0', '10080', 10080],
    ['168', '0', 10080],
  ])('accepts %s h / %s min as %s minutes', (hours, minutes, stored) => {
    expect(durationMinutes(withHoursMinutes(base, hours, minutes)!)).toBe(stored);
  });
  it.each([
    ['0', '0'],
    ['0', '0.4'],
    ['0', '10081'],
    ['168', '0.4'],
    ['169', '0'],
  ])('rejects %s h / %s min (out of 1..10080 on the input)', (hours, minutes) => {
    expect(withHoursMinutes(base, hours, minutes)).toBeNull();
  });
});
