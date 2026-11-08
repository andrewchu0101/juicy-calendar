import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/useT';
import { LanguageMenu } from '../../components/LanguageMenu';
import { useAppStore } from '../../stores/appStore';
import { settingsPagePatchSchema } from '../../services/persistence/schemas';

/** A workspace page; the mounted calendar keeps its selection, date and scroll position. */
export function SettingsPage({ onBack }: { onBack(): void }) {
  const t = useT();
  const back = useRef<HTMLButtonElement>(null);
  const settings = useAppStore(state => state.settings);
  const updateSettings = useAppStore(state => state.updateSettings);
  useEffect(() => { back.current?.focus(); }, []);
  return <main data-testid="settings-page" className="h-full overflow-auto bg-canvas p-6 text-ink">
    <div className="mx-auto max-w-xl">
      <button ref={back} onClick={onBack} className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ink">{t('settings.back')}</button>
      <h1 className="mt-6 mb-6 text-2xl font-semibold">{t('settings.title')}</h1>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface px-5">
        <div className="py-4"><LanguageMenu className="!items-start" /></div>
        {(['startHour', 'endHour', 'pixelsPerMinute'] as const).map(key => (
          <label key={key} className="flex items-center justify-between gap-6 py-4 text-sm">
            <span>{t(key === 'startHour' ? 'settings.timelineStart' : key === 'endHour' ? 'settings.timelineEnd' : 'toolbar.zoom')}</span>
            <input type="number" className="w-24 rounded-md border border-line-strong px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-ink"
              min={key === 'pixelsPerMinute' ? 0.5 : 0} max={key === 'startHour' ? 23 : key === 'endHour' ? 24 : 3}
              step={key === 'pixelsPerMinute' ? 0.05 : 1} value={settings[key]}
              onChange={event => {
                const patch = settingsPagePatchSchema.safeParse({ [key]: event.currentTarget.value === '' ? NaN : Number(event.currentTarget.value) });
                if (patch.success) updateSettings(patch.data);
                else event.currentTarget.value = String(settings[key]);
              }} />
          </label>
        ))}
        <label className="flex items-center justify-between gap-6 py-4 text-sm">
          <span>{t('toolbar.magnet')}</span>
          <input type="checkbox" aria-label={t('toolbar.magnetAria')} checked={settings.magnetEnabled}
            onChange={event => updateSettings({ magnetEnabled: event.currentTarget.checked })} />
        </label>
      </div>
    </div>
  </main>;
}
