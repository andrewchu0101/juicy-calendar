import { format } from 'date-fns';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { useAppStore } from '../../stores/appStore';
import type { CalendarEvent } from '../../types';
import {
  durationMinutes,
  formatDuration,
  withDate,
  withDuration,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function InspectorPanel({ event }: { event: CalendarEvent }) {
  const templateName = useAppStore((state) => state.templates[event.templateId]?.name);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const deleteEvent = useAppStore((state) => state.deleteEvent);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const applyTimes = (times: EventTimes | null) => (times ? updateEvent(event.id, times) : false);
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const duration = durationMinutes(event);

  return (
    <section
      data-testid="inspector"
      aria-label="Event details"
      className="card-pop absolute top-14 right-6 z-40 flex max-h-[calc(100%-5rem)] w-[17rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl"
    >
      <div className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
        <span data-testid="inspector-template" className="min-w-0 flex-1 truncate text-xs text-muted">
          {templateName ?? 'Deleted template'}
        </span>
        <button
          aria-label="Collapse inspector"
          data-testid="inspector-collapse"
          className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
          onClick={() => updateSettings({ inspectorCollapsed: true })}
        >
          ›
        </button>
      </div>

      <Field label="Name">
        <DraftInput
          aria-label="Name"
          data-testid="inspector-title"
          value={event.title}
          onCommit={(title) => updateEvent(event.id, { title }) && title.trim() !== event.title}
        />
      </Field>
      <Field label="Date">
        <DraftInput
          type="date"
          aria-label="Date"
          data-testid="inspector-date"
          value={format(start, 'yyyy-MM-dd')}
          onCommit={(date) => applyTimes(withDate(event, date))}
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Start">
          <DraftInput
            type="time"
            aria-label="Start"
            data-testid="inspector-start"
            value={format(start, 'HH:mm')}
            onCommit={(time) => applyTimes(withStartTime(event, time))}
          />
        </Field>
        <Field label="End">
          <DraftInput
            type="time"
            aria-label="End"
            data-testid="inspector-end"
            value={format(end, 'HH:mm')}
            onCommit={(time) => applyTimes(withEndTime(event, time))}
          />
        </Field>
      </div>
      <Field label={`Duration (minutes) · ${formatDuration(duration)}`}>
        <DraftInput
          type="number"
          min={1}
          aria-label="Duration in minutes"
          data-testid="inspector-duration"
          value={String(Math.round(duration))}
          onCommit={(minutes) => applyTimes(withDuration(event, Number(minutes)))}
        />
      </Field>
      <div className="flex flex-col gap-1.5 text-xs text-muted">
        Colour
        <ColorPicker value={event.color} onChange={(color) => updateEvent(event.id, { color })} />
      </div>
      <button
        data-testid="inspector-delete"
        className="mt-1 self-start rounded-full px-1 text-sm font-medium text-danger hover:underline"
        onClick={() => deleteEvent(event.id)}
      >
        Delete event
      </button>
    </section>
  );
}

export function Inspector() {
  const event = useAppStore((state) =>
    state.selectedEventId ? state.events[state.selectedEventId] : undefined,
  );
  const collapsed = useAppStore((state) => state.settings.inspectorCollapsed);
  const updateSettings = useAppStore((state) => state.updateSettings);

  if (!event) return null;
  if (collapsed) {
    return (
      <button
        aria-label="Expand inspector"
        data-testid="inspector-expand"
        className="absolute top-14 right-6 z-40 flex size-9 items-center justify-center rounded-full border border-line bg-surface shadow-lg transition-transform hover:scale-110"
        onClick={() => updateSettings({ inspectorCollapsed: false })}
      >
        <span className="size-3.5 rounded-full" style={{ backgroundColor: event.color }} />
      </button>
    );
  }
  return <InspectorPanel key={event.id} event={event} />;
}
