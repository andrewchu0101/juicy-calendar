import { EVENT_MAX_MINUTES, EVENT_MIN_MINUTES, NAME_MAX_CHARS, NEW_EVENT_MINUTES } from './limits';

export type TimedEvent = { startAt: string; endAt: string };
export type EventTimes = TimedEvent;

const MS_PER_MINUTE = 60_000;

function times(start: Date, end: Date): EventTimes {
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function durationMinutes(event: TimedEvent): number {
  return (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / MS_PER_MINUTE;
}

export function newEventTimes(start: Date): EventTimes {
  return times(start, new Date(start.getTime() + NEW_EVENT_MINUTES * MS_PER_MINUTE));
}

/** Moves an event so the grabbed point follows the pointer. Elapsed duration is preserved. */
export function moveEvent(event: TimedEvent, pointerTime: Date, grabOffsetMs: number): EventTimes {
  const elapsed = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
  const start = new Date(pointerTime.getTime() - grabOffsetMs);
  return times(start, new Date(start.getTime() + elapsed));
}

/** Top edge: the end stays fixed. */
export function resizeStart(event: TimedEvent, pointerTime: Date): EventTimes {
  const end = new Date(event.endAt);
  const latest = end.getTime() - EVENT_MIN_MINUTES * MS_PER_MINUTE;
  const earliest = end.getTime() - EVENT_MAX_MINUTES * MS_PER_MINUTE;
  return times(new Date(Math.min(Math.max(pointerTime.getTime(), earliest), latest)), end);
}

/** Bottom edge: the start stays fixed. */
export function resizeEnd(event: TimedEvent, pointerTime: Date): EventTimes {
  const start = new Date(event.startAt);
  const earliest = start.getTime() + EVENT_MIN_MINUTES * MS_PER_MINUTE;
  const latest = start.getTime() + EVENT_MAX_MINUTES * MS_PER_MINUTE;
  return times(start, new Date(Math.min(Math.max(pointerTime.getTime(), earliest), latest)));
}

function atLocal(date: Date, time: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

function shiftTo(event: TimedEvent, start: Date): EventTimes {
  const elapsed = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
  return times(start, new Date(start.getTime() + elapsed));
}

/** Inspector: moves the event to another date, keeping its start time and duration. */
export function withDate(event: TimedEvent, date: string): EventTimes | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const current = new Date(event.startAt);
  const start = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    current.getHours(),
    current.getMinutes(),
    current.getSeconds(),
  );
  // 不存在的日期（2026-02-30）會被 Date 進位到下個月；往返比對不一致就拒絕（SRS R-3）。
  const exists =
    start.getFullYear() === Number(match[1]) &&
    start.getMonth() === Number(match[2]) - 1 &&
    start.getDate() === Number(match[3]);
  return exists ? shiftTo(event, start) : null;
}

/** Inspector: changes the start time on the same date, keeping the duration. */
export function withStartTime(event: TimedEvent, time: string): EventTimes | null {
  const start = atLocal(new Date(event.startAt), time);
  return start && shiftTo(event, start);
}

/**
 * Inspector: changes the end time on the date the event currently ends on, keeping the start.
 * The result must be strictly after the start and no longer than EVENT_MAX_MINUTES; otherwise
 * it is rejected. It is never read as the next day (SRS R-3, PRD Q-04).
 */
export function withEndTime(event: TimedEvent, time: string): EventTimes | null {
  const start = new Date(event.startAt);
  const end = atLocal(new Date(event.endAt), time);
  if (!end) return null;
  const minutes = (end.getTime() - start.getTime()) / MS_PER_MINUTE;
  return minutes >= EVENT_MIN_MINUTES && minutes <= EVENT_MAX_MINUTES ? times(start, end) : null;
}

/** Inspector: changes the duration, keeping the start. The range is judged on the input, then it is rounded. */
export function withDuration(event: TimedEvent, minutes: number): EventTimes | null {
  if (!Number.isFinite(minutes) || minutes < EVENT_MIN_MINUTES || minutes > EVENT_MAX_MINUTES) return null;
  const start = new Date(event.startAt);
  return times(start, new Date(start.getTime() + Math.round(minutes) * MS_PER_MINUTE));
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** 名稱規則（SRS R-3）：去前後空白後非空，且不超過 NAME_MAX_CHARS 個使用者看到的字元。不合法回傳 null。 */
export function validateTitle(raw: string): string | null {
  const title = raw.trim();
  if (title === '') return null;
  let count = 0;
  for (const _ of graphemes.segment(title)) {
    count += 1;
    if (count > NAME_MAX_CHARS) return null;
  }
  return title;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

