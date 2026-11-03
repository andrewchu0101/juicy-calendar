import { format } from 'date-fns';
import { useAppStore } from '../../../stores/appStore';
import { useCalendarModel } from '../hooks/useCalendarModel';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

function rangeLabel(days: Date[]): string {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return '';
  if (days.length === 1) return format(first, 'EEEE, MMMM d, yyyy');
  const sameMonth = first.getMonth() === last.getMonth();
  return `${format(first, 'MMM d')} – ${format(last, sameMonth ? 'd, yyyy' : 'MMM d, yyyy')}`;
}

const iconButton =
  'flex size-8 items-center justify-center rounded-full text-lg text-ink transition-transform hover:scale-110 hover:bg-line active:scale-95';

export function CalendarToolbar() {
  const { days } = useCalendarModel();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const navigate = useAppStore((state) => state.navigate);
  const goToday = useAppStore((state) => state.goToday);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 pl-1">
      <div className="flex items-center gap-0.5">
        <button className={iconButton} aria-label="Previous period" onClick={() => navigate(-1)}>
          ‹
        </button>
        <button className={iconButton} aria-label="Next period" onClick={() => navigate(1)}>
          ›
        </button>
        <button className="ml-1 rounded-full px-3 py-1 text-sm font-medium hover:bg-line" onClick={goToday}>
          Today
        </button>
      </div>

      <h2 data-testid="range-label" className="m-0 text-base font-semibold tracking-tight">
        {rangeLabel(days)}
      </h2>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <label className="flex items-center gap-1 text-muted">
          <span className="sr-only">Timeline start</span>
          <select
            aria-label="Timeline start"
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
            aria-label="Timeline end"
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
          <input type="checkbox" aria-label="30 minute magnet" checked={settings.magnetEnabled} onChange={event => updateSettings({ magnetEnabled: event.target.checked })} />
          30 min magnet
        </label>
        <label className="flex items-center gap-2 text-muted">
          Zoom
          <input
            type="range"
            aria-label="Zoom"
            className="w-20 accent-ink"
            min={0.5}
            max={3}
            step={0.05}
            value={settings.pixelsPerMinute}
            onChange={(event) => updateSettings({ pixelsPerMinute: Number(event.target.value) })}
          />
        </label>

        <div role="group" aria-label="View" className="flex rounded-full bg-line p-0.5">
          {(['week', 'day'] as const).map((view) => (
            <button
              key={view}
              aria-pressed={settings.view === view}
              className="rounded-full px-3 py-1 font-medium capitalize text-muted transition-colors aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm"
              onClick={() => updateSettings({ view })}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
