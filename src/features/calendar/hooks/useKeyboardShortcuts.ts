import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { pointerToTime, type Point } from '../engine';
import { useCalendarModel } from './useCalendarModel';
import { measureGrid, type ElementRef } from './useEventInteractions';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useKeyboardShortcuts(columnsRef: ElementRef, enabled = true) {
  const pointer = useRef<Point | null>(null);
  const gesturePointer = useRef<number | null>(null);
  const { days, timeline } = useCalendarModel();
  useEffect(() => {
    const onMove = (event: PointerEvent) => { pointer.current = { x: event.clientX, y: event.clientY }; };
    const clear = () => { pointer.current = null; gesturePointer.current = null; };
    const onOut = (event: PointerEvent) => { if (!event.relatedTarget) clear(); };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (columnsRef.current?.contains(event.target) || event.target.closest('[data-testid="template-ball"]')) {
        gesturePointer.current = event.pointerId;
      }
    };
    const onUp = (event: PointerEvent) => {
      if (gesturePointer.current === event.pointerId) gesturePointer.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerout', onOut);
    window.addEventListener('blur', clear);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', clear);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [columnsRef]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Text fields keep their native editing keys, including their own undo.
      if (isTyping(event.target)) return;
      if (!enabled) {
        if (['Delete', 'Backspace'].includes(event.key) || event.ctrlKey || event.metaKey) event.preventDefault();
        return;
      }
      // A pointer draft owns event commands until it commits or cancels; Escape stays with the gesture.
      if (event.key !== 'Escape' && (gesturePointer.current !== null || document.body.classList.contains('is-interacting'))) {
        if (['Delete', 'Backspace'].includes(event.key) || event.ctrlKey || event.metaKey) event.preventDefault();
        return;
      }
      const store = useAppStore.getState();

      if ((event.metaKey || event.ctrlKey) && ['c', 'v'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'c') store.copySelected();
        else {
          const point = pointer.current;
          const columns = columnsRef.current;
          const hit = point ? document.elementFromPoint(point.x, point.y) : null;
          if (point && columns && hit && columns.contains(hit)) {
            store.pasteCopied(pointerToTime(point, measureGrid(columns, days.length), days, timeline, {
              magnetEnabled: store.settings.magnetEnabled,
            }));
          }
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && (store.selectedEventId || store.selectedEventIds.length > 0)) {
        event.preventDefault();
        store.deleteSelected();
        return;
      }
      if (event.key === 'Escape') store.select(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [columnsRef, days, timeline, enabled]);
}
