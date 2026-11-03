import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { CalendarEvent } from '../../../types';
import {
  edgeScrollSpeed,
  moveEvent,
  magnetMinutes,
  pointerToTime,
  resizeEnd,
  resizeStart,
  type EventTimes,
  type GridGeometry,
  type Point,
  type TimelineConfig,
  minutesFromColumnStart,
  columnMinutesToDate,
} from '../engine';

export type ElementRef = RefObject<HTMLDivElement | null>;

export type InteractionMode = 'move' | 'resize-start' | 'resize-end';

export type InteractionDraft = {
  eventId: string;
  mode: InteractionMode;
  times: EventTimes;
  pointer: Point;
};

/** Pointer travel before a press becomes a drag, so clicks and double-clicks never move an event. */
const DRAG_THRESHOLD = 4;

export function measureGrid(columns: HTMLElement, columnCount: number): GridGeometry {
  const rect = columns.getBoundingClientRect();
  return { left: rect.left, top: rect.top, columnWidth: rect.width / columnCount, columnCount };
}

/** Moving and resizing events. Draft state stays here; the store changes only on commit. */
export function useEventInteractions(
  scrollerRef: ElementRef,
  columnsRef: ElementRef,
  days: Date[],
  timeline: TimelineConfig,
) {
  const [draft, setDraft] = useState<InteractionDraft | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const begin = useCallback(
    (press: ReactPointerEvent, event: CalendarEvent, mode: InteractionMode) => {
      const columns = columnsRef.current;
      const scroller = scrollerRef.current;
      if (press.button !== 0 || !columns || !scroller) return;
      press.stopPropagation();
      useAppStore.getState().select(event.id);

      const pointerId = press.pointerId;
      const origin: Point = { x: press.clientX, y: press.clientY };
      const timeAt = (point: Point) =>
        pointerToTime(point, measureGrid(columns, days.length), days, timeline, {
          allowOverflow: mode !== 'move',
        });
      // The grabbed point keeps its distance from the edge it controls, so nothing jumps on press.
      const reference = mode === 'resize-end' ? event.endAt : event.startAt;
      const grabOffsetMs = timeAt(origin).getTime() - new Date(reference).getTime();

      let pointer = origin;
      let active = false;
      let latest: EventTimes | null = null;
      let frame = 0;

      const update = () => {
        const time = timeAt(pointer);
        const rawEdge = new Date(time.getTime() - grabOffsetMs);
        const day = days[0]!;
        const edgeTime = columnMinutesToDate(day, magnetMinutes(minutesFromColumnStart(rawEdge, day, timeline), timeline.pixelsPerMinute, useAppStore.getState().settings.magnetEnabled), timeline);
        if (mode === 'move') latest = moveEvent(event, edgeTime, 0);
        else if (mode === 'resize-start') latest = resizeStart(event, edgeTime);
        else latest = resizeEnd(event, edgeTime);
        setDraft({ eventId: event.id, mode, times: latest, pointer });
      };

      const tick = () => {
        const rect = scroller.getBoundingClientRect();
        const speed = edgeScrollSpeed(pointer.y, rect.top, rect.bottom);
        // The resulting scroll event recalculates the time under the stationary pointer.
        if (speed !== 0) scroller.scrollTop += speed;
        frame = requestAnimationFrame(tick);
      };

      const stop = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', stop);
        window.removeEventListener('keydown', onKey, true);
        scroller.removeEventListener('scroll', update);
        if (columns.hasPointerCapture(pointerId)) columns.releasePointerCapture(pointerId);
        document.body.classList.remove('is-interacting', 'is-interacting-move', 'is-interacting-resize');
        stopRef.current = null;
        setDraft(null);
      };

      const activate = () => {
        active = true;
        // Captured only once dragging, so plain clicks and double-clicks keep their real target.
        columns.setPointerCapture(pointerId);
        document.body.classList.add('is-interacting', mode === 'move' ? 'is-interacting-move' : 'is-interacting-resize');
        scroller.addEventListener('scroll', update);
        frame = requestAnimationFrame(tick);
      };

      function onMove(move: PointerEvent) {
        if (move.pointerId !== pointerId) return;
        pointer = { x: move.clientX, y: move.clientY };
        if (!active) {
          if (Math.hypot(pointer.x - origin.x, pointer.y - origin.y) < DRAG_THRESHOLD) return;
          activate();
        }
        update();
      }

      function onUp(up: PointerEvent) {
        if (up.pointerId !== pointerId) return;
        const result = latest;
        stop();
        if (active && result) useAppStore.getState().updateEvent(event.id, result);
      }

      function onKey(key: KeyboardEvent) {
        if (key.key !== 'Escape') return;
        // Only a drag in progress claims Escape; otherwise it falls through to normal handling.
        if (!active) return;
        key.stopPropagation();
        stop();
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('keydown', onKey, true);
      stopRef.current = stop;
    },
    [days, timeline, scrollerRef, columnsRef],
  );

  return { draft, begin };
}
