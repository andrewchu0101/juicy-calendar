import { addDays, format } from 'date-fns';

export const NEW_EVENT_MINUTES = 120;
export const MIN_EVENT_MINUTES = 1;

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
  const latest = end.getTime() - MIN_EVENT_MINUTES * MS_PER_MINUTE;
  return times(new Date(Math.min(pointerTime.getTime(), latest)), end);
}

/** Bottom edge: the start stays fixed. */
export function resizeEnd(event: TimedEvent, pointerTime: Date): EventTimes {
  const start = new Date(event.startAt);
  const earliest = start.getTime() + MIN_EVENT_MINUTES * MS_PER_MINUTE;
  return times(start, new Date(Math.max(pointerTime.getTime(), earliest)));
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
  return Number.isNaN(start.getTime()) ? null : shiftTo(event, start);
}

/** Inspector: changes the start time on the same date, keeping the duration. */
export function withStartTime(event: TimedEvent, time: string): EventTimes | null {
  const start = atLocal(new Date(event.startAt), time);
  return start && shiftTo(event, start);
}

/**
 * Inspector: changes the end time, keeping the start. Keeps the end's date when that is still
 * after the start; otherwise uses the next occurrence of that time, which may cross midnight.
 */
export function withEndTime(event: TimedEvent, time: string): EventTimes | null {
  const start = new Date(event.startAt);
  const sameEndDate = atLocal(new Date(event.endAt), time);
  if (!sameEndDate) return null;
  if (sameEndDate > start) return times(start, sameEndDate);
  const sameStartDate = atLocal(start, time);
  if (sameStartDate && sameStartDate > start) return times(start, sameStartDate);
  const nextDay = atLocal(addDays(start, 1), time);
  return nextDay && times(start, nextDay);
}

/** Inspector: changes the duration, keeping the start. */
export function withDuration(event: TimedEvent, minutes: number): EventTimes | null {
  if (!Number.isFinite(minutes) || minutes < MIN_EVENT_MINUTES) return null;
  const start = new Date(event.startAt);
  return times(start, new Date(start.getTime() + Math.round(minutes) * MS_PER_MINUTE));
}

export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimeRange(event: TimedEvent): string {
  return `${format(new Date(event.startAt), 'HH:mm')}–${format(new Date(event.endAt), 'HH:mm')}`;
}
