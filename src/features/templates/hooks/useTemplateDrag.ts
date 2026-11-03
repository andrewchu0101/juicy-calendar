import { PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { visibleFeedbackPoint, edgeScrollSpeed, newEventTimes, pointerToTime, type Point } from '../../calendar/engine';
import type { GhostEvent } from '../../calendar/components/CalendarGrid';
import { measureGrid, type ElementRef } from '../../calendar/hooks/useEventInteractions';
import { useCalendarModel } from '../../calendar/hooks/useCalendarModel';

export type Splash = { key: number; x: number; y: number; color: string };

function pointerOf(event: { activatorEvent: Event; delta: { x: number; y: number } }): Point {
  const start = event.activatorEvent as PointerEvent;
  return { x: start.clientX + event.delta.x, y: start.clientY + event.delta.y };
}

/** Dragging a ball from the palette: dnd-kit runs the gesture, the engine resolves the time. */
export function useTemplateDrag(scrollerRef: ElementRef, columnsRef: ElementRef) {
  const { days, timeline } = useCalendarModel();
  const templates = useAppStore((state) => state.templates);
  const [manualPoint, setManualPoint] = useState<Point | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostEvent | null>(null);
  const [burst, setBurst] = useState<Splash | null>(null);
  const [splash, setSplash] = useState<Splash | null>(null);
  const leftWindowRef = useRef(false);
  const overlayBallRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<Point | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const frameRef = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const timeAt = useCallback(
    (point: Point): Date | null => {
      const scroller = scrollerRef.current;
      const columns = columnsRef.current;
      if (!scroller || !columns) return null;
      // Hit-testing excludes anything floating above the grid, such as the inspector.
      const target = document.elementFromPoint(point.x, point.y);
      if (!target || !columns.contains(target)) return null;
      return pointerToTime(point, measureGrid(columns, days.length), days, timeline, { magnetEnabled: useAppStore.getState().settings.magnetEnabled });
    },
    [days, timeline, scrollerRef, columnsRef],
  );

  const refreshGhost = useCallback(
    (templateId: string) => {
      const template = useAppStore.getState().templates[templateId];
      const time = pointerRef.current && timeAt(pointerRef.current);
      setGhost(
        template && time
          ? { id: 'ghost', title: template.name, color: template.color, ...newEventTimes(time) }
          : null,
      );
    },
    [timeAt],
  );

  const stopLoop = () => cancelAnimationFrame(frameRef.current);
  useEffect(() => stopLoop, []);

  const finish = () => {
    stopLoop();
    pointerRef.current = null;
    lastPointRef.current = null;
    setActiveId(null);
    setManualPoint(null);
    setGhost(null);
  };

  const start = (templateId: string, point: Point) => {
    leftWindowRef.current = false;
    setActiveId(templateId);
    // Closes the floating inspector, so the whole calendar is available as a drop target.
    useAppStore.getState().select(null);
    pointerRef.current = point;

    const tick = () => {
      const scroller = scrollerRef.current;
      const point = pointerRef.current;
      if (scroller && point) {
        const rect = scroller.getBoundingClientRect();
        const inside = point.x >= rect.left && point.x <= rect.right;
        const speed = inside ? edgeScrollSpeed(point.y, rect.top, rect.bottom) : 0;
        if (speed !== 0) {
          scroller.scrollTop += speed;
          refreshGhost(templateId);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  const move = (templateId: string, point: Point) => {
    const last = lastPointRef.current ?? point;
    pointerRef.current = point;
    lastPointRef.current = point;
    refreshGhost(templateId);

    // Stretch along the direction of travel, in proportion to speed. Purely visual.
    const ball = overlayBallRef.current;
    if (ball && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      const stretch = Math.min(Math.hypot(dx, dy) / 90, 0.22);
      const angle = Math.atan2(dy, dx);
      ball.style.transform = `rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch}) rotate(${-angle}rad)`;
    }
  };

  const end = (templateId: string, point: Point) => {
    const time = timeAt(point);
    finish();
    if (!time) {
      setBurst({ key: Date.now(), ...visibleFeedbackPoint(point, window.innerWidth, window.innerHeight), color: templates[templateId]?.color ?? "#000000" });
      return;
    }
    const store = useAppStore.getState();
    if (store.createEventFromTemplate(templateId, time)) {
      const color = store.templates[templateId]?.color ?? '#000000';
      setSplash({ key: Date.now(), x: point.x, y: point.y, color });
    }
  };

  useEffect(() => {
    if (!activeId) return;
    const onBlur = () => {
      leftWindowRef.current = true;
      // PointerSensor owns cancellation and removes its document listeners.
      document.dispatchEvent(new PointerEvent('pointercancel'));
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [activeId]);

  const onDragCancel = () => {
    if (leftWindowRef.current && activeId && pointerRef.current) {
      setBurst({ key: Date.now(), ...visibleFeedbackPoint(pointerRef.current, window.innerWidth, window.innerHeight), color: templates[activeId]?.color ?? '#000000' });
    }
    finish();
  };

  return {
    dndProps: {
      sensors,
      autoScroll: false,
      onDragStart: (event: DragStartEvent) => start(String(event.active.id), pointerOf({ ...event, delta: { x: 0, y: 0 } })),
      onDragMove: (event: DragMoveEvent) => move(String(event.active.id), pointerOf(event)),
      onDragEnd: (event: DragEndEvent) => end(String(event.active.id), pointerOf(event)),
      onDragCancel,
    },
    radial: {
      start: (id: string, point: Point) => { start(id, point); setManualPoint(point); move(id, point); },
      move: (id: string, point: Point) => { setManualPoint(point); move(id, point); },
      end,
      cancel: onDragCancel,
    },
    manualPoint,
    activeTemplate: activeId ? (templates[activeId] ?? null) : null,
    ghost,
    splash,
    burst,
    overlayBallRef,
  };
}
