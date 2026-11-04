import { format, isSameDay } from 'date-fns';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { formatDate } from '../../../i18n/dateFormat';
import { useI18nStore } from '../../../i18n/i18n';
import { hiddenEventsTitle } from '../../../i18n/hiddenEventsTitle';
import { formatTimeRange } from '../../../i18n/formatTimeRange';
import { useT } from '../../../i18n/useT';
import { useTimeFormat } from '../../../i18n/useTimeFormat';
import {
  isPastDate,
  formatDuration,
  durationMinutes,
  hiddenEventCounts,
  hourMarks,
  layoutSegments,
  minutesFromColumnStart,
  minutesToPixels,
  timelineHeight,
  timelineSpanMinutes,
  type TimedEvent,
} from '../engine';
import { useCalendarModel } from '../hooks/useCalendarModel';
import { useEventInteractions, type ElementRef } from '../hooks/useEventInteractions';
import { EventBlock, GhostBlock } from './EventBlock';

export type GhostEvent = TimedEvent & { id: string; title: string; color: string };

const GUTTER_WIDTH = 56;
const MIN_COLUMN_WIDTH = 84;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Keeps the time at the middle of the view in place while zooming. */
function useZoomAnchoring(scrollerRef: ElementRef, pixelsPerMinute: number) {
  const previous = useRef(pixelsPerMinute);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller && previous.current !== pixelsPerMinute) {
      const middle = scroller.scrollTop + scroller.clientHeight / 2;
      scroller.scrollTop = (middle * pixelsPerMinute) / previous.current - scroller.clientHeight / 2;
    }
    previous.current = pixelsPerMinute;
  }, [scrollerRef, pixelsPerMinute]);
}

export function CalendarGrid({
  scrollerRef,
  columnsRef,
  ghost,
}: {
  scrollerRef: ElementRef;
  columnsRef: ElementRef;
  ghost: GhostEvent | null;
}) {
  const { days, timeline } = useCalendarModel();
  const t = useT();
  const timeFormat = useTimeFormat();
  const language = useI18nStore((state) => state.language);
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const editingEventId = useAppStore((state) => state.editingEventId);
  const droppedEventId = useAppStore((state) => state.droppedEventId);
  const select = useAppStore((state) => state.select);
  const openDay = useAppStore((state) => state.openDay);
  const now = useNow();
  const { draft, begin } = useEventInteractions(scrollerRef, columnsRef, days, timeline);
  useZoomAnchoring(scrollerRef, timeline.pixelsPerMinute);

  const displayed = useMemo(
    () =>
      Object.values(events).map((event) =>
        event.id === draft?.eventId ? { ...event, ...draft.times } : event,
      ),
    [events, draft],
  );
  const segments = useMemo(() => layoutSegments(displayed, days, timeline), [displayed, days, timeline]);
  const hidden = useMemo(() => hiddenEventCounts(displayed, days, timeline), [displayed, days, timeline]);
  const ghostSegments = useMemo(
    () => (ghost ? layoutSegments([ghost], days, timeline) : []),
    [ghost, days, timeline],
  );
  const marks = useMemo(() => hourMarks(timeline), [timeline]);
  const height = timelineHeight(timeline);
  const span = timelineSpanMinutes(timeline);
  const columnPercent = 100 / days.length;
  const draftEvent = draft ? { ...events[draft.eventId], ...draft.times } : null;

  return (
    <div
      ref={scrollerRef}
      data-testid="calendar-scroller"
      className="calendar-scroller relative min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-surface"
    >
      <div style={{ minWidth: GUTTER_WIDTH + MIN_COLUMN_WIDTH * days.length }}>
        <div className="sticky top-0 z-30 flex border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER_WIDTH }} />
          {days.map((day, index) => {
            const today = isSameDay(day, now);
            const hiddenCount = hidden[index] ?? 0;
            return (
              <button
                key={day.toISOString()}
                data-testid="day-header"
                title={t('grid.openDay', { weekday: formatDate(day, 'EEEE', language) })}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 py-2 text-sm hover:bg-canvas"
                onClick={() => openDay(day)}
              >
                <span className="text-muted">{formatDate(day, 'EEE', language)}</span>
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-semibold ${today ? 'bg-ink text-white' : ''}`}
                >
                  {format(day, 'd')}
                </span>
                {hiddenCount > 0 && (
                  <span
                    data-testid="hidden-count"
                    title={hiddenEventsTitle(language, hiddenCount)}
                    className="rounded-full bg-line px-1.5 text-xs text-muted"
                  >
                    +{hiddenCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex">
          <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER_WIDTH, height }}>
            <div className="relative h-full">
              {marks.map((mark) => (
                <span
                  key={mark.minutes}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums first:translate-y-0.5"
                  style={{ top: minutesToPixels(mark.minutes, timeline) }}
                >
                  {mark.label}
                  {mark.nextDay && mark.hour === 0 && <sup className="ml-0.5 text-[9px]">+1</sup>}
                </span>
              ))}
            </div>
          </div>

          <div
            ref={columnsRef}
            data-testid="calendar-columns"
            className="relative min-w-0 flex-1"
            style={{ height }}
            onPointerDown={() => select(null)}
          >
            {Array.from({ length: Math.floor(span / 30) }, (_, index) => (index + 1) * 30).filter(minutes => minutes % 60 !== 0).map(minutes => (
              <div key={`half-${minutes}`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: minutesToPixels(minutes, timeline) }} />
            ))}
            {marks.map((mark) => (
              <div
                key={mark.minutes}
                className={`absolute inset-x-0 border-t ${mark.nextDay && mark.hour === 0 ? 'border-line-strong' : 'border-line/70'}`}
                style={{ top: minutesToPixels(mark.minutes, timeline) }}
              />
            ))}

            {days.map((day, columnIndex) => {
              const nowMinutes = minutesFromColumnStart(now, day, timeline);
              return (
                <div
                  key={day.toISOString()}
                  data-testid="day-column"
                  className="absolute inset-y-0 border-l border-line/70"
                  style={{ left: `${columnIndex * columnPercent}%`, width: `${columnPercent}%` }}
                >
                  {nowMinutes >= 0 && nowMinutes < span && (
                    <div
                      data-testid="now-line"
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-ink/50"
                      style={{ top: minutesToPixels(nowMinutes, timeline) }}
                    />
                  )}
                  {ghostSegments
                    .filter((segment) => segment.columnIndex === columnIndex)
                    .map((segment) =>
                      ghost ? <GhostBlock key={segment.key} segment={segment} event={ghost} /> : null,
                    )}
                  {segments
                    .filter((segment) => segment.columnIndex === columnIndex)
                    .map((segment) => {
                      const event = displayed.find((item) => item.id === segment.eventId);
                      if (!event) return null;
                      return (
                        <EventBlock
                          key={segment.key}
                          past={isPastDate(day, now)}
                          segment={segment}
                          event={event}
                          selected={selectedEventId === event.id}
                          editing={editingEventId === event.id}
                          dropped={droppedEventId === event.id}
                          active={draft?.eventId === event.id}
                          onBegin={(press, mode) => {
                            // A gesture always starts from the stored event, not a draft.
                            const stored = events[event.id];
                            if (stored) begin(press, stored, mode);
                          }}
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {draft && draftEvent && (
        <div
          data-testid="drag-chip"
          className="pointer-events-none fixed z-50 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white tabular-nums shadow-lg"
          style={{ left: draft.pointer.x + 14, top: draft.pointer.y + 14 }}
        >
          {formatTimeRange(draft.times, timeFormat)} · {formatDuration(durationMinutes(draft.times))}
        </div>
      )}
    </div>
  );
}
