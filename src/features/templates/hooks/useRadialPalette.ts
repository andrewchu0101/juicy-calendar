import { useEffect, useRef, useState } from 'react';
import { sortedTemplates, useAppStore } from '../../../stores/appStore';
import { RADIAL_LONG_PRESS_MS, RADIAL_MOVE_TOLERANCE_PX, radialBalls, radialRing, radialStep, type Point, type RadialRing } from '../../calendar/engine';

type Menu = { origin: Point; positions: Point[]; ring: RadialRing; hovered: number };

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
        const count = sortedTemplates(templates).length;
        session = { origin, positions: radialBalls(origin, count, window.innerWidth, window.innerHeight), ring: radialRing(origin, count, window.innerWidth, window.innerHeight), hovered: -1 };
        setMenu(session);
      }, RADIAL_LONG_PRESS_MS);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const point = { x: event.clientX, y: event.clientY };
      if (draggingId) {
        dragRef.current.move(draggingId, point);
      } else if (session) {
        const step = radialStep(session.hovered, point, session.positions, session.ring);
        const picked = step.picked === null ? undefined : sortedTemplates(templates)[step.picked];
        if (picked) {
          draggingId = picked.id;
          session = null;
          setMenu(null);
          dragRef.current.start(picked.id, point);
        } else if (step.hovered !== session.hovered) {
          session = { ...session, hovered: step.hovered };
          setMenu(session);
        }
      } else if (origin && Math.hypot(point.x - origin.x, point.y - origin.y) > RADIAL_MOVE_TOLERANCE_PX) clear();
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
