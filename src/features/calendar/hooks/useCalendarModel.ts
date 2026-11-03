import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { visibleDays, type TimelineConfig } from '../engine';

/** What is on screen right now: the visible columns and the timeline. */
export function useCalendarModel(): { days: Date[]; timeline: TimelineConfig } {
  const anchor = useAppStore((state) => state.anchor);
  const view = useAppStore((state) => state.settings.view);
  const startHour = useAppStore((state) => state.settings.startHour);
  const endHour = useAppStore((state) => state.settings.endHour);
  const pixelsPerMinute = useAppStore((state) => state.settings.pixelsPerMinute);

  const days = useMemo(() => visibleDays(view, new Date(anchor)), [view, anchor]);
  const timeline = useMemo(
    () => ({ startHour, endHour, pixelsPerMinute }),
    [startHour, endHour, pixelsPerMinute],
  );
  return { days, timeline };
}
