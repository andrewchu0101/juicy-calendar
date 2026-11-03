import { useEffect, useRef, useState } from 'react';
import { sortedTemplates, useAppStore } from '../../../stores/appStore';
import { radialBalls, radialHit, type Point } from '../../calendar/engine';

type Menu = { origin: Point; positions: Point[]; hovered: number };

type Drag = {
  start: (id: string, point: Point) => void;
  move: (id: string, point: Point) => void;
  end: (id: string, point: Point) => void;
  cancel: () => void;
};

export function useRadialPalette(drag: Drag) {
  const dragRef = useRef(drag);
  useEffect(() => { dragRef.current = drag; });
  const templates = useAppStore(state => state.templates);
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    let draggingId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let session: Menu | null = null;
    let origin: Point | null = null;
    let pointerId: number | null = null;
    const clear = () => { clearTimeout(timer); session = null; origin = null; pointerId = null; setMenu(null); };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('button,input,select,textarea,[role="button"],[data-testid="event-block"]')) return;
      clear();
      pointerId = event.pointerId;
      origin = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        if (!origin) return;
        session = { origin, positions: radialBalls(origin, sortedTemplates(templates).length, window.innerWidth, window.innerHeight), hovered: -1 };
        setMenu(session);
      }, 450);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const point = { x: event.clientX, y: event.clientY };
      if (draggingId) {
        dragRef.current.move(draggingId, point);
      } else if (session) {
        session = { ...session, hovered: radialHit(point, session.positions) };
        if (session.hovered >= 0) {
          const template = sortedTemplates(templates)[session.hovered];
          if (template) {
            draggingId = template.id;
            session = null;
            setMenu(null);
            dragRef.current.start(template.id, point);
          }
        } else setMenu(session);
      } else if (origin && Math.hypot(point.x - origin.x, point.y - origin.y) > 6) clear();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (draggingId) {
        dragRef.current.end(draggingId, { x: event.clientX, y: event.clientY });
        draggingId = null;
      }
      clear();
    };
    const cancel = () => { if (draggingId) dragRef.current.cancel(); draggingId = null; clear(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [templates]);
  return { menu, templates: sortedTemplates(templates) };
}
