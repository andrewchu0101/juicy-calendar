import { format } from 'date-fns';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { useT } from '../../i18n/useT';
import { useAppStore } from '../../stores/appStore';
import type { CalendarEvent } from '../../types';
import {
  INSPECTOR_WIDTH_PX,
  durationMinutes,
  formatDuration,
  withDate,
  withHoursMinutes,
  withEndTime,
  withStartTime,
  type EventTimes,
} from '../calendar/engine';

/**
 * A text-like input holding a draft that commits on Enter, blur, or unmount (a press on another event
 * unmounts it). Escape reverts. onCommit returns false to reject the value.
 */
function DraftInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (value: string) => boolean } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(
    () => () => {
      if (pending.current !== null) commitRef.current(pending.current);
    },
    [],
  );

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = () => {
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    if (next === value || !onCommit(next)) setDraft(value);
  };

  return (
    <input
      {...props}
      value={draft}
      className="w-full min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm tabular-nums select-text focus:border-ink focus:outline-none"
      onChange={(event) => {
        pending.current = event.target.value;
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(key) => {
        key.stopPropagation();
        if (key.key === 'Enter') commit();
        if (key.key === 'Escape') {
          pending.current = null;
          setDraft(value);
          key.currentTarget.blur();
        }
      }}
    />
  );
}

const INPUT_CLASS =
  'w-full min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm tabular-nums select-text focus:border-ink focus:outline-none';

function splitMinutes(total: number): { hours: string; minutes: string } {
  const rounded = Math.round(total);
  return { hours: String(Math.floor(rounded / 60)), minutes: String(rounded % 60) };
}

/**
 * 持續時間的「小時」「分鐘」兩欄（票 021，SRS R-3）。兩欄共用草稿，焦點離開整組、按 Enter 或卸載時
 * 一起提交；Escape 還原。onCommit 回傳 false 表示拒絕，兩欄還原為目前事件的值。
 */
function DurationFields({
  label,
  hoursLabel,
  minutesLabel,
  hoursAria,
  minutesAria,
  minutes,
  onCommit,
}: {
  label: string;
  hoursLabel: string;
  minutesLabel: string;
  hoursAria: string;
  minutesAria: string;
  minutes: number;
  onCommit: (hours: string, minutes: string) => boolean;
}) {
  const current = splitMinutes(minutes);
  const [draft, setDraft] = useState(current);
  const [lastMinutes, setLastMinutes] = useState(minutes);
  const pending = useRef<{ hours: string; minutes: string } | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(
    () => () => {
      if (pending.current) commitRef.current(pending.current.hours, pending.current.minutes);
    },
    [],
  );

  if (minutes !== lastMinutes) {
    setLastMinutes(minutes);
    setDraft(current);
  }

  const commit = () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    if (!onCommit(next.hours, next.minutes)) setDraft(current);
  };

  const edit = (patch: Partial<typeof draft>) => {
    const next = { ...(pending.current ?? draft), ...patch };
    pending.current = next;
    setDraft(next);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-1 text-xs text-muted"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) commit();
      }}
      onKeyDown={(key) => {
        key.stopPropagation();
        if (key.key === 'Enter') commit();
        if (key.key === 'Escape') {
          pending.current = null;
          setDraft(current);
          (key.target as HTMLElement).blur();
        }
      }}
    >
      {label}
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          {hoursLabel}
          <input
            type="number"
            min={0}
            step={1}
            aria-label={hoursAria}
            data-testid="inspector-duration-hours"
            value={draft.hours}
            className={INPUT_CLASS}
            onChange={(event) => edit({ hours: event.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          {minutesLabel}
          <input
            type="number"
            min={0}
            aria-label={minutesAria}
            data-testid="inspector-duration-minutes"
            value={draft.minutes}
            className={INPUT_CLASS}
            onChange={(event) => edit({ minutes: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function InspectorPanel({ event, docked, onCollapse }: { event: CalendarEvent; docked: boolean; onCollapse: () => void }) {
  const t = useT();
  const templateName = useAppStore((state) => state.templates[event.templateId]?.name);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const deleteEvent = useAppStore((state) => state.deleteEvent);

  const applyTimes = (times: EventTimes | null) => (times ? updateEvent(event.id, times) : false);
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const duration = durationMinutes(event);

  return (
    <section
      data-testid="inspector"
      aria-label={t('inspector.aria')}
      data-docked={docked}
      style={{ width: INSPECTOR_WIDTH_PX }}
      className={`card-pop flex flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl ${
        docked ? 'max-h-full shrink-0 self-start' : 'absolute top-2 right-4 z-40 max-h-[calc(100%-1rem)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
        <span data-testid="inspector-template" className="min-w-0 flex-1 truncate text-xs text-muted">
          {templateName ?? t('inspector.deletedTemplate')}
        </span>
        <button
          aria-label={t('inspector.collapse')}
          data-testid="inspector-collapse"
          className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
          onClick={onCollapse}
        >
          ›
        </button>
      </div>

      <Field label={t('field.name')}>
        <DraftInput
          aria-label={t('field.name')}
          data-testid="inspector-title"
          value={event.title}
          onCommit={(title) => updateEvent(event.id, { title }) && title.trim() !== event.title}
        />
      </Field>
      <Field label={t('field.date')}>
        <DraftInput
          type="date"
          aria-label={t('field.date')}
          data-testid="inspector-date"
          value={format(start, 'yyyy-MM-dd')}
          onCommit={(date) => applyTimes(withDate(event, date))}
        />
      </Field>
      <div className="flex gap-2">
        <Field label={t('field.start')}>
          <DraftInput
            type="time"
            aria-label={t('field.start')}
            data-testid="inspector-start"
            value={format(start, 'HH:mm')}
            onCommit={(time) => applyTimes(withStartTime(event, time))}
          />
        </Field>
        <Field label={t('field.end')}>
          <DraftInput
            type="time"
            aria-label={t('field.end')}
            data-testid="inspector-end"
            value={format(end, 'HH:mm')}
            onCommit={(time) => applyTimes(withEndTime(event, time))}
          />
        </Field>
      </div>
      <DurationFields
        label={t('inspector.durationLabel', { duration: formatDuration(duration) })}
        hoursLabel={t('inspector.durationHoursLabel')}
        minutesLabel={t('inspector.durationMinutesLabel')}
        hoursAria={t('inspector.durationHoursAria')}
        minutesAria={t('inspector.durationMinutesAria')}
        minutes={duration}
        onCommit={(hours, minutes) => applyTimes(withHoursMinutes(event, hours, minutes))}
      />
      <div className="flex flex-col gap-1.5 text-xs text-muted">
        {t('color.label')}
        <ColorPicker value={event.color} onChange={(color) => updateEvent(event.id, { color })} />
      </div>
      <button
        data-testid="inspector-delete"
        className="mt-1 self-start rounded-full px-1 text-sm font-medium text-danger hover:underline"
        onClick={() => deleteEvent(event.id)}
      >
        {t('inspector.delete')}
      </button>
    </section>
  );
}

/**
 * 單選時的編輯面板（票 027）。docked＝日曆區放得下「面板＋完整日曆欄」：面板固定佔版面，是否收合由使用者的偏好
 * （`inspectorCollapsed`，存檔）決定。放不下：預設收合成圓點，點開只是「暫時展開」（元件內狀態，不存檔、不改偏好），
 * 所以視窗大小不會覆寫使用者的選擇；選取的活動不變。
 */
export function Inspector({ docked }: { docked: boolean }) {
  const t = useT();
  const event = useAppStore((state) =>
    state.selectedEventId ? state.events[state.selectedEventId] : undefined,
  );
  const collapsed = useAppStore((state) => state.settings.inspectorCollapsed);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [peek, setPeek] = useState(false);

  if (!event) return null;
  const open = docked ? !collapsed : peek;
  if (!open) {
    return (
      <button
        aria-label={t('inspector.expand')}
        data-testid="inspector-expand"
        // 放在日曆左上角、時間軸那一格（原本是空的）：不遮任何日期標題、日曆欄或活動（票 027）。
        className="absolute top-1 left-3 z-40 flex size-8 items-center justify-center rounded-full border border-line bg-surface shadow-lg transition-transform hover:scale-110"
        onClick={() => (docked ? updateSettings({ inspectorCollapsed: false }) : setPeek(true))}
      >
        {/* 與 radial 選單 hover 球相同的果凍起伏（index.css 的 radial-wobble），讓縮小的面板容易辨認。 */}
        <span data-testid="inspector-expand-dot" className="inspector-dot size-5 rounded-full" style={{ backgroundColor: event.color }} />
      </button>
    );
  }
  return (
    <InspectorPanel
      key={event.id}
      event={event}
      docked={docked}
      onCollapse={() => (docked ? updateSettings({ inspectorCollapsed: true }) : setPeek(false))}
    />
  );
}
