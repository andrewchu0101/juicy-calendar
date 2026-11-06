import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { RADIAL_LONG_PRESS_MS, RADIAL_MOVE_TOLERANCE_PX, rectFromPoints, rectsIntersect, type Point, type Rect } from '../engine';

/**
 * 在日曆空白處按下後快速拖曳＝框選（SRS FR-12）。長按時間與移動容許值和 radial 選單共用，
 * 所以兩個手勢互斥：先移動超過容許值是框選，先滿長按時間是 radial。手勢狀態留在這裡，放開才寫進 store。
 */
export function useMarqueeSelect() {
  const [rect, setRect] = useState<Rect | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const onPointerDown = useCallback((press: ReactPointerEvent<HTMLElement>) => {
    const store = useAppStore.getState();
    // 框選前的選取，Escape 時還原。
    const before = store.selectedEventIds.length > 0 ? store.selectedEventIds : store.selectedEventId ? [store.selectedEventId] : [];
    store.select(null);
    if (press.button !== 0) return;

    const columns = press.currentTarget;
    const pointerId = press.pointerId;
    const origin: Point = { x: press.clientX, y: press.clientY };
    let marquee = false;
    let radialOpen = false;
    const timer = setTimeout(() => { radialOpen = true; }, RADIAL_LONG_PRESS_MS);

    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('is-interacting');
      stopRef.current = null;
      setRect(null);
    };

    function onMove(move: PointerEvent) {
      if (move.pointerId !== pointerId || radialOpen) return;
      const point = { x: move.clientX, y: move.clientY };
      if (!marquee) {
        if (Math.hypot(point.x - origin.x, point.y - origin.y) <= RADIAL_MOVE_TOLERANCE_PX) return;
        marquee = true;
        clearTimeout(timer);
        document.body.classList.add('is-interacting');
      }
      setRect(rectFromPoints(origin, point));
    }

    function onUp(up: PointerEvent) {
      if (up.pointerId !== pointerId) return;
      const final = marquee ? rectFromPoints(origin, { x: up.clientX, y: up.clientY }) : null;
      stop();
      if (!final) return;
      const ids = new Set<string>();
      columns.querySelectorAll<HTMLElement>('[data-event-id]').forEach((block) => {
        if (rectsIntersect(final, block.getBoundingClientRect())) ids.add(block.dataset.eventId!);
      });
      useAppStore.getState().selectMany([...ids]);
    }

    function onKey(key: KeyboardEvent) {
      if (key.key !== 'Escape' || !marquee) return;
      // Only a marquee in progress claims Escape; otherwise it falls through to clearing the selection.
      key.stopPropagation();
      stop();
      useAppStore.getState().selectMany(before);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('keydown', onKey, true);
    stopRef.current = stop;
  }, []);

  return { rect, onPointerDown };
}
