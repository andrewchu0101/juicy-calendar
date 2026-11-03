import { addDays, differenceInCalendarDays, startOfDay, startOfWeek } from 'date-fns';

export type TimelineConfig = {
  /** First visible hour, 0–23. */
  startHour: number;
  /** Last visible hour, 0–24. A value at or before startHour means the following day. */
  endHour: number;
  pixelsPerMinute: number;
};

export const MINUTES_PER_DAY = 1440;
export const WEEK_STARTS_ON = 1;

export function timelineSpanMinutes({ startHour, endHour }: TimelineConfig): number {
  const hours = (endHour - startHour + 24) % 24;
  return (hours === 0 ? 24 : hours) * 60;
}

export function timelineHeight(timeline: TimelineConfig): number {
  return timelineSpanMinutes(timeline) * timeline.pixelsPerMinute;
}

export function minutesToPixels(minutes: number, timeline: TimelineConfig): number {
  return minutes * timeline.pixelsPerMinute;
}

export function pixelsToMinutes(pixels: number, timeline: TimelineConfig): number {
  return pixels / timeline.pixelsPerMinute;
}

/**
 * Wall-clock minutes between a column's timeline start and an instant. Negative when the instant
 * is before the column, and at or above the span when it is after. Wall-clock (rather than elapsed)
 * keeps blocks aligned with the hour labels on days with a daylight-saving change.
 */
export function minutesFromColumnStart(instant: Date, columnDay: Date, timeline: TimelineConfig): number {
  const dayOffset = differenceInCalendarDays(instant, columnDay);
  const minuteOfDay = instant.getHours() * 60 + instant.getMinutes() + instant.getSeconds() / 60;
  return dayOffset * MINUTES_PER_DAY + minuteOfDay - timeline.startHour * 60;
}

/** The instant at a wall-clock offset in a column. Offsets may run past the column's end. */
export function columnMinutesToDate(columnDay: Date, minutes: number, timeline: TimelineConfig): Date {
  return new Date(
    columnDay.getFullYear(),
    columnDay.getMonth(),
    columnDay.getDate(),
    timeline.startHour,
    Math.round(minutes),
  );
}

export function visibleDays(view: 'week' | 'day', anchor: Date): Date[] {
  if (view === 'day') return [startOfDay(anchor)];
  const first = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function shiftAnchor(view: 'week' | 'day', anchor: Date, direction: 1 | -1): Date {
  return addDays(anchor, direction * (view === 'week' ? 7 : 1));
}

export type HourMark = {
  minutes: number;
  hour: number;
  label: string;
  /** True when this mark falls on the day after the column's date. */
  nextDay: boolean;
};

export function hourMarks(timeline: TimelineConfig): HourMark[] {
  const hours = timelineSpanMinutes(timeline) / 60;
  return Array.from({ length: hours }, (_, index) => {
    const absolute = timeline.startHour + index;
    const hour = absolute % 24;
    return {
      minutes: index * 60,
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      nextDay: absolute >= 24,
    };
  });
}

/** Past calendar columns are muted; today's earlier hours retain their colour. */
export function isPastDate(day: Date, now: Date): boolean {
  return differenceInCalendarDays(day, now) < 0;
}
