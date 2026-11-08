import { DndContext } from '@dnd-kit/core';
import { useRef, useState } from 'react';
import { SettingsPage } from '../features/settings/SettingsPage';
import { Notices } from '../components/Notices';
import { CalendarGrid } from '../features/calendar/components/CalendarGrid';
import { CalendarToolbar } from '../features/calendar/components/CalendarToolbar';
import { INSPECTOR_GAP_PX, inspectorFits } from '../features/calendar/engine';
import { useElementWidth } from '../features/calendar/hooks/useElementWidth';
import { useKeyboardShortcuts } from '../features/calendar/hooks/useKeyboardShortcuts';
import { Inspector } from '../features/inspector/Inspector';
import { DropSplash, SplitBurst, TemplateDragOverlay } from '../features/templates/components/TemplateDragOverlay';
import { RadialPalette } from '../features/templates/components/RadialPalette';
import { TemplatePalette } from '../features/templates/components/TemplatePalette';
import { useTemplateDrag } from '../features/templates/hooks/useTemplateDrag';
import { useAppStore } from '../stores/appStore';

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const drag = useTemplateDrag(scrollerRef, columnsRef);
  useKeyboardShortcuts(columnsRef, !settingsOpen);
  const areaRef = useRef<HTMLDivElement>(null);
  const areaWidth = useElementWidth(areaRef);
  const dayCount = useAppStore((state) => (state.settings.view === 'day' ? 1 : 7));
  // 面板固定佔版面（不遮日曆）還是收合成圓點，由日曆區放不放得下完整的日曆欄決定（票 027、NFR-07）。
  const docked = inspectorFits(areaWidth, dayCount);

  return (
    <DndContext {...drag.dndProps}>
      {settingsOpen && <SettingsPage onBack={() => {
        setSettingsOpen(false);
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid="open-settings"]')?.focus());
      }} />}
      <div className="flex h-full select-none" style={{ display: settingsOpen ? 'none' : undefined }}>
        <TemplatePalette />
        <main className="relative flex min-w-0 flex-1 flex-col pr-3 pb-3">
          <CalendarToolbar onOpenSettings={() => setSettingsOpen(true)} />
          {/* 日曆區是一列：日曆在左、面板在右。放得下時面板固定佔版面（日曆讓出寬度，不遮任何日期）；放不下時面板改成
              右上角圓點，點開才以浮層顯示（票 027、NFR-07）。浮層與圓點錨定在這個區塊，而非整個 main：工具列在窄視窗
              折行時，它們不會蓋住工具列。 */}
          <div ref={areaRef} className="relative flex min-h-0 flex-1" style={{ columnGap: INSPECTOR_GAP_PX }}>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <CalendarGrid scrollerRef={scrollerRef} columnsRef={columnsRef} ghost={drag.ghost} />
            </div>
            <Inspector docked={docked} />
          </div>
        </main>
      </div>
      <TemplateDragOverlay template={drag.activeTemplate} ballRef={drag.overlayBallRef} point={drag.manualPoint} />
      <DropSplash splash={drag.splash} />
      <SplitBurst burst={drag.burst} />
      <RadialPalette drag={drag.radial} columnsRef={columnsRef} />
      <Notices />
    </DndContext>
  );
}
