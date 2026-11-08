import { format, isSameDay } from 'date-fns';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { formatDate } from '../../../i18n/dateFormat';
import { useI18nStore } from '../../../i18n/i18n';
import { hiddenEventsTitle } from '../../../i18n/hiddenEventsTitle';
import { formatTime } from '../../../i18n/formatTime';
import { formatTimeRange } from '../../../i18n/formatTimeRange';
import { useT } from '../../../i18n/useT';
import { useTimeFormat } from '../../../i18n/useTimeFormat';
import {
  GUTTER_WIDTH_PX,
  MIN_COLUMN_WIDTH_PX,
  columnMinutesToDate,
  isPastDate,
  formatDuration,
  durationMinutes,
  hiddenEventCounts,
  hourMarks,
  layoutSegments,
  minutesFromColumnStart,
  minutesToPixels,
  pointerToTime,
  timelineHeight,
  timelineSpanMinutes,
  type TimedEvent,
} from '../engine';
import { useCalendarModel } from '../hooks/useCalendarModel';
import { useMarqueeSelect } from '../hooks/useMarqueeSelect';
import { measureGrid, useEventInteractions, type ElementRef } from '../hooks/useEventInteractions';
import { EventBlock, GhostBlock } from './EventBlock';
import { menuPosition } from '../engine/menuPosition';

export type GhostEvent = TimedEvent & { id: string; title: string; color: string };

// Like toolbar hour labels, shared clock labels use a neutral day, independent of a visible DST transition.
const TIME_LABEL_DAY = new Date(2000, 0, 1);

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
  const selectedEventIds = useAppStore((state) => state.selectedEventIds);
  const copiedEvents = useAppStore((state) => state.copiedEvents);
  const canUndo = useAppStore((state) => state.past.length > 0);
  const canRedo = useAppStore((state) => state.future.length > 0);
  const openDay = useAppStore((state) => state.openDay);
  const now = useNow();
  const { draft, begin } = useEventInteractions(scrollerRef, columnsRef, days, timeline);
  const marquee = useMarqueeSelect();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; start: Date; eventId: string | null } | null>(null);
  const rightPressTime = useRef<Date | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const heldPointer = useRef<number | null>(null);
  useEffect(() => {
    const down = (event: PointerEvent) => { if (event.button === 0) heldPointer.current = event.pointerId; };
    const up = (event: PointerEvent) => { if (heldPointer.current === event.pointerId) heldPointer.current = null; };
    const clear = () => { heldPointer.current = null; };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', clear);
    };
  }, []);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !contextMenu) return;
    const position = menuPosition(contextMenu, menu.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    menu.style.left = `${position.x}px`;
    menu.style.top = `${position.y}px`;
  }, [contextMenu]);
  useEffect(() => {
    if (!contextMenu) return;
    const menu = menuRef.current;
    const items = () => [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    (items()[0] ?? menu)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!['Escape', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Tab', 'Delete', 'Backspace'].includes(event.key) && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape' || event.key === 'Tab') setContextMenu(null);
      const enabled = items();
      const index = enabled.findIndex(item => item === document.activeElement);
      if (event.key === 'ArrowDown') enabled[(index + 1) % enabled.length]?.focus();
      if (event.key === 'ArrowUp') enabled[(index - 1 + enabled.length) % enabled.length]?.focus();
      if (event.key === 'Home') enabled[0]?.focus();
      if (event.key === 'End') enabled.at(-1)?.focus();
      if (event.key === 'Enter') enabled[index]?.click();
    };
    const close = () => setContextMenu(null);
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.anchor !== previous.anchor || state.settings.view !== previous.settings.view) close();
    });
    window.addEventListener('scroll', close, true);
    window.addEventListener('wheel', close, { capture: true, passive: true });
    window.addEventListener('keydown', onKey, true);
    return () => {
      unsubscribe();
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('wheel', close, true);
      window.removeEventListener('keydown', onKey, true);
      if (!useAppStore.getState().editingEventId) returnFocus.current?.focus({ preventScroll: true });
    };
  }, [contextMenu]);
  useZoomAnchoring(scrollerRef, timeline.pixelsPerMinute);

  const displayed = useMemo(
    () =>
      Object.values(events).map((event) => {
        const preview = draft?.batch?.[event.id] ?? (event.id === draft?.eventId ? draft.times : undefined);
        return preview ? { ...event, ...preview } : event;
      }),
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
      <div style={{ minWidth: GUTTER_WIDTH_PX + MIN_COLUMN_WIDTH_PX * days.length }}>
        <div className="sticky top-0 z-30 flex border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER_WIDTH_PX }} />
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
          <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER_WIDTH_PX, height }}>
            <div className="relative h-full">
              {marks.map((mark) => (
                <span
                  key={mark.minutes}
                  data-testid="timeline-label"
                  className="absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap text-muted tabular-nums first:translate-y-0.5"
                  style={{ top: minutesToPixels(mark.minutes, timeline) }}
                >
                  {formatTime(columnMinutesToDate(TIME_LABEL_DAY, mark.minutes, timeline), timeFormat)}
                  {mark.nextDay && mark.hour === 0 && <sup className="ml-0.5 text-[9px]">+1</sup>}
                </span>
              ))}
            </div>
          </div>

          <div
            ref={columnsRef}
            data-testid="calendar-columns"
            tabIndex={-1}
            className="relative min-w-0 flex-1"
            style={{ height }}
            onPointerDown={(event) => {
              if (event.button === 2) {
                rightPressTime.current = pointerToTime(
                  { x: event.clientX, y: event.clientY }, measureGrid(event.currentTarget, days.length), days, timeline,
                  { magnetEnabled: useAppStore.getState().settings.magnetEnabled },
                );
              }
              marquee.onPointerDown(event);
            }}
            onContextMenu={(event) => {
              if (!(event.target instanceof Element) || event.target.closest('input, textarea, select, [contenteditable]')) return;
              event.preventDefault();
              if (heldPointer.current !== null || draft || marquee.rect || ghost) return;
              if (!rightPressTime.current) return;
              const eventId = event.target.closest<HTMLElement>('[data-event-id]')?.dataset.eventId ?? null;
              const state = useAppStore.getState();
              if (eventId && state.selectedEventId !== eventId && !state.selectedEventIds.includes(eventId)) state.select(eventId);
              returnFocus.current = eventId ? event.target.closest<HTMLElement>('[data-event-id]') : event.currentTarget;
              setContextMenu({ x: event.clientX, y: event.clientY, start: rightPressTime.current, eventId });
            }}
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
                          selected={selectedEventId === event.id || selectedEventIds.includes(event.id)}
                          editing={editingEventId === event.id}
                          dropped={droppedEventId === event.id}
                          active={draft?.eventId === event.id || Boolean(draft?.batch?.[event.id])}
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

      {contextMenu && <div aria-hidden="true" className="fixed inset-0 z-40"
        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}
        onContextMenu={event => { event.preventDefault(); setContextMenu(null); }}
        onClick={event => { event.stopPropagation(); setContextMenu(null); }} />}
      {contextMenu && (
        <div
          role="menu"
          ref={menuRef}
          tabIndex={-1}
          aria-label={t('contextMenu.label')}
          className="fixed z-50 min-h-8 min-w-40 rounded-lg border border-line bg-surface p-1 text-sm text-ink shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.eventId && <button
            role="menuitem"
            className="flex w-full items-center justify-between gap-6 rounded px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ink"
            onClick={() => { useAppStore.getState().copySelected(); setContextMenu(null); }}
          >
            <span>{t('contextMenu.copy')}</span><span aria-hidden="true">{t('shortcut.copy')}</span>
          </button>}
          {contextMenu.eventId ? <button
            role="menuitem"
            className="flex w-full items-center justify-between gap-6 rounded px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ink"
            onClick={() => { useAppStore.getState().deleteSelected(); setContextMenu(null); }}
          >
            <span>{t('contextMenu.delete')}</span><span aria-hidden="true">{t('shortcut.delete')}</span>
          </button> : <button
            role="menuitem"
            disabled={copiedEvents.length === 0}
            onClick={() => {
              useAppStore.getState().pasteCopied(contextMenu.start);
              setContextMenu(null);
            }}
            className="flex w-full items-center justify-between gap-6 rounded px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
          >
            <span>{t('contextMenu.paste')}</span>
            <span aria-hidden="true">{t('shortcut.paste')}</span>
          </button>}
          {contextMenu.eventId && selectedEventIds.length === 0 && <button
            role="menuitem"
            className="flex w-full items-center rounded px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ink"
            onClick={() => { useAppStore.getState().setEditing(contextMenu.eventId); setContextMenu(null); }}
          >{t('contextMenu.rename')}</button>}
          {!contextMenu.eventId && (['undo', 'redo'] as const).map(action => (
            <button key={action} role="menuitem" disabled={action === 'undo' ? !canUndo : !canRedo}
              className="flex w-full items-center justify-between gap-6 rounded px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
              onClick={() => { useAppStore.getState()[action](); setContextMenu(null); }}>
              <span>{t(action === 'undo' ? 'contextMenu.undo' : 'contextMenu.redo')}</span>
              <span aria-hidden="true">{t(action === 'undo' ? 'shortcut.undo' : 'shortcut.redo')}</span>
            </button>
          ))}
        </div>
      )}

      {marquee.rect && (
        <div
          data-testid="marquee"
          className="pointer-events-none fixed z-40 rounded border border-ink/60 bg-ink/10"
          style={{ left: marquee.rect.left, top: marquee.rect.top, width: marquee.rect.right - marquee.rect.left, height: marquee.rect.bottom - marquee.rect.top }}
        />
      )}

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
