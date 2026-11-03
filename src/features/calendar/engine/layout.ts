import { addDays } from 'date-fns';
import { durationMinutes, type TimedEvent } from './mutations';
import { minutesFromColumnStart, minutesToPixels, timelineSpanMinutes, type TimelineConfig } from './timeline';

/** Keeps very short events visible and grabbable. */
export const MIN_SEGMENT_HEIGHT = 18;

export type EventSegment = {
  key: string;
  eventId: string;
  columnIndex: number;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  /** False when the event continues before this segment (no top resize handle). */
  isStart: boolean;
  /** False when the event continues after this segment (no bottom resize handle). */
  isEnd: boolean;
};

type Positioned = Omit<EventSegment, 'lane' | 'laneCount'> & { sortStart: number };

function positionEvent(
  event: TimedEvent & { id: string },
  days: Date[],
  timeline: TimelineConfig,
): Positioned[] {
  const span = timelineSpanMinutes(timeline);
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const segments: Positioned[] = [];

  days.forEach((day, columnIndex) => {
    const rawStart = minutesFromColumnStart(start, day, timeline);
    // During a fall-back hour the wall-clock end can precede the start; elapsed time is the truth.
    const rawEnd = Math.max(
      minutesFromColumnStart(end, day, timeline),
      rawStart + Math.min(durationMinutes(event), 1),
    );
    if (rawEnd <= 0 || rawStart >= span) return;

    const clippedStart = Math.max(rawStart, 0);
    const clippedEnd = Math.min(rawEnd, span);
    const top = minutesToPixels(clippedStart, timeline);
    const bottomLimit = minutesToPixels(span, timeline);
    const height = Math.max(minutesToPixels(clippedEnd - clippedStart, timeline), MIN_SEGMENT_HEIGHT);

    segments.push({
      key: `${event.id}:${columnIndex}`,
      eventId: event.id,
      columnIndex,
      // A minimum-height sliver at the bottom edge is nudged up rather than clipped.
      top: Math.min(top, Math.max(0, bottomLimit - height)),
      height,
      isStart: rawStart >= 0,
      isEnd: rawEnd <= span,
      sortStart: clippedStart,
    });
  });
  return segments;
}

/** Assigns side-by-side lanes for visual overlap. Never changes any event's time. */
function assignLanes(column: Positioned[]): EventSegment[] {
  const sorted = [...column].sort(
    (a, b) => a.top - b.top || b.height - a.height || a.eventId.localeCompare(b.eventId),
  );
  const output: EventSegment[] = [];
  let cluster: EventSegment[] = [];
  let laneEnds: number[] = [];
  let clusterBottom = -Infinity;

  const flush = () => {
    for (const segment of cluster) segment.laneCount = laneEnds.length;
    output.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterBottom = -Infinity;
  };

  for (const { sortStart: _unused, ...segment } of sorted) {
    if (segment.top >= clusterBottom) flush();
    let lane = laneEnds.findIndex((bottom) => bottom <= segment.top);
    if (lane === -1) lane = laneEnds.length;
    const bottom = segment.top + segment.height;
    laneEnds[lane] = bottom;
    clusterBottom = Math.max(clusterBottom, bottom);
    cluster.push({ ...segment, lane, laneCount: 1 });
  }
  flush();
  return output;
}

/** Positions events for the given columns. Used identically by Weekly and Daily Views. */
export function layoutSegments(
  events: (TimedEvent & { id: string })[],
  days: Date[],
  timeline: TimelineConfig,
): EventSegment[] {
  const byColumn = new Map<number, Positioned[]>();
  for (const event of events) {
    for (const segment of positionEvent(event, days, timeline)) {
      const column = byColumn.get(segment.columnIndex) ?? [];
      column.push(segment);
      byColumn.set(segment.columnIndex, column);
    }
  }
  return [...byColumn.values()].flatMap(assignLanes);
}

/** Per column, the number of events on that date that the visible timeline does not show at all. */
export function hiddenEventCounts(
  events: (TimedEvent & { id: string })[],
  days: Date[],
  timeline: TimelineConfig,
): number[] {
  return days.map((day) => {
    const dayStart = day.getTime();
    const dayEnd = addDays(day, 1).getTime();
    return events.filter((event) => {
      const start = new Date(event.startAt).getTime();
      const end = new Date(event.endAt).getTime();
      if (end <= dayStart || start >= dayEnd) return false;
      return positionEvent(event, days, timeline).length === 0;
    }).length;
  });
}
