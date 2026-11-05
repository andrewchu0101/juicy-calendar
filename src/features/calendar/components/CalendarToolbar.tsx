import { LanguageMenu } from '../../../components/LanguageMenu';
import { useAppStore } from '../../../stores/appStore';
import { useI18nStore } from '../../../i18n/i18n';
import { formatTime } from '../../../i18n/formatTime';
import { rangeLabel } from '../../../i18n/rangeLabel';
import { useT } from '../../../i18n/useT';
import { useTimeFormat } from '../../../i18n/useTimeFormat';
import { useCalendarModel } from '../hooks/useCalendarModel';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const iconButton =
  'flex size-8 items-center justify-center rounded-full text-lg text-ink transition-transform hover:scale-110 hover:bg-line active:scale-95';

export function CalendarToolbar() {
  const { days } = useCalendarModel();
  const t = useT();
  const timeFormat = useTimeFormat();
  /** 時間軸選單的整點標籤，跟隨 Windows 的 12／24 小時設定（FR-10）。 */
  const hourLabel = (hour: number) => formatTime(new Date(2000, 0, 1, hour, 0), timeFormat);
  const language = useI18nStore((state) => state.language);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const navigate = useAppStore((state) => state.navigate);
  const goToday = useAppStore((state) => state.goToday);

  return (
    <header data-testid="calendar-toolbar" className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 pl-1">
      <div className="flex items-center gap-0.5">
        <button className={iconButton} aria-label={t('toolbar.previous')} onClick={() => navigate(-1)}>
          ‹
        </button>
        <button className={iconButton} aria-label={t('toolbar.next')} onClick={() => navigate(1)}>
          ›
        </button>
        <button className="ml-1 rounded-full px-3 py-1 text-sm font-medium hover:bg-line" onClick={goToday}>
          {t('toolbar.today')}
        </button>
      </div>

      <h2 data-testid="range-label" className="m-0 text-base font-semibold tracking-tight">
        {rangeLabel(days, language)}
      </h2>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <label className="flex items-center gap-1 text-muted">
          <span className="sr-only">{t('toolbar.timelineStart')}</span>
          <select
            aria-label={t('toolbar.timelineStart')}
            className="rounded-md bg-transparent py-1 text-ink"
            value={settings.startHour}
            onChange={(event) => updateSettings({ startHour: Number(event.target.value) })}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
          <span aria-hidden>→</span>
          <select
            aria-label={t('toolbar.timelineEnd')}
            className="rounded-md bg-transparent py-1 text-ink"
            value={settings.endHour % 24}
            onChange={(event) => updateSettings({ endHour: Number(event.target.value) })}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
                {hour <= settings.startHour ? ' +1' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" aria-label={t('toolbar.magnetAria')} checked={settings.magnetEnabled} onChange={event => updateSettings({ magnetEnabled: event.target.checked })} />
          {t('toolbar.magnet')}
        </label>
        <label className="flex items-center gap-2 text-muted">
          {t('toolbar.zoom')}
          <input
            type="range"
            aria-label={t('toolbar.zoom')}
            className="w-20 accent-ink"
            min={0.5}
            max={3}
            step={0.05}
            value={settings.pixelsPerMinute}
            onChange={(event) => updateSettings({ pixelsPerMinute: Number(event.target.value) })}
          />
        </label>

        <div role="group" aria-label={t('toolbar.view')} className="flex rounded-full bg-line p-0.5">
          {(['week', 'day'] as const).map((view) => (
            <button
              key={view}
              aria-pressed={settings.view === view}
              className="rounded-full px-3 py-1 font-medium capitalize text-muted transition-colors aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm"
              onClick={() => updateSettings({ view })}
            >
              {t(view === 'week' ? 'toolbar.viewWeek' : 'toolbar.viewDay')}
            </button>
          ))}
        </div>

        <LanguageMenu className="!flex-row !items-center" />
      </div>
    </header>
  );
}
