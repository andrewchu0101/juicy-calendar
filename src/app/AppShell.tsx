import { DndContext } from '@dnd-kit/core';
import { useRef } from 'react';
import { Notices } from '../components/Notices';
import { CalendarGrid } from '../features/calendar/components/CalendarGrid';
import { CalendarToolbar } from '../features/calendar/components/CalendarToolbar';
import { useKeyboardShortcuts } from '../features/calendar/hooks/useKeyboardShortcuts';
import { Inspector } from '../features/inspector/Inspector';
import { DropSplash, SplitBurst, TemplateDragOverlay } from '../features/templates/components/TemplateDragOverlay';
import { RadialPalette } from '../features/templates/components/RadialPalette';
import { TemplatePalette } from '../features/templates/components/TemplatePalette';
import { useTemplateDrag } from '../features/templates/hooks/useTemplateDrag';

export function AppShell() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const drag = useTemplateDrag(scrollerRef, columnsRef);
  useKeyboardShortcuts();

  return (
    <DndContext {...drag.dndProps}>
      <div className="flex h-full select-none">
        <TemplatePalette />
        <main className="relative flex min-w-0 flex-1 flex-col pr-3 pb-3">
          <CalendarToolbar />
          <CalendarGrid scrollerRef={scrollerRef} columnsRef={columnsRef} ghost={drag.ghost} />
          <Inspector />
        </main>
      </div>
      <TemplateDragOverlay template={drag.activeTemplate} ballRef={drag.overlayBallRef} point={drag.manualPoint} />
      <DropSplash splash={drag.splash} />
      <SplitBurst burst={drag.burst} />
      <RadialPalette drag={drag.radial} />
      <Notices />
    </DndContext>
  );
}
