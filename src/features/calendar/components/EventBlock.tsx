import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { formatTimeRange } from '../../../i18n/formatTimeRange';
import { useT } from '../../../i18n/useT';
import { useTimeFormat } from '../../../i18n/useTimeFormat';
import type { CalendarEvent } from '../../../types';
import { mutedEventColor, readableTextColor } from '../../../utils/color';
import { type EventSegment } from '../engine';
import type { InteractionMode } from '../hooks/useEventInteractions';
import type { GhostEvent } from './CalendarGrid';

const GAP = 2;

function segmentStyle(segment: EventSegment): CSSProperties {
  const laneWidth = 100 / segment.laneCount;
  return {
    top: segment.top,
    height: segment.height,
    left: `calc(${segment.lane * laneWidth}% + ${GAP}px)`,
    width: `calc(${laneWidth}% - ${GAP * 2}px)`,
  };
}

function cornerClasses(segment: EventSegment): string {
  return `${segment.isStart ? 'rounded-t-lg' : ''} ${segment.isEnd ? 'rounded-b-lg' : ''}`;
}

function TitleEditor({ event }: { event: CalendarEvent }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const eventId = event.id;
  const initialTitle = event.title;

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.select();
    // Saves on every exit (Enter, blur, or a press elsewhere) unless Escape cancelled it.
    return () => {
      const title = input?.value;
      // 名稱規則由 store 的 updateEvent 判定；被拒絕時事件不變，畫面回到原名稱。
      if (!cancelled.current && title !== undefined && title !== initialTitle) {
        useAppStore.getState().updateEvent(eventId, { title });
      }
    };
  }, [eventId, initialTitle]);

  const close = () => useAppStore.getState().setEditing(null);

  return (
    <input
      ref={inputRef}
      data-testid="event-title-input"
      aria-label={t('event.nameAria')}
      defaultValue={event.title}
      className="absolute inset-x-1 top-1 z-10 min-w-0 rounded bg-white/90 px-1 py-0.5 text-xs font-semibold text-ink outline-none select-text"
      onPointerDown={(press) => press.stopPropagation()}
      onDoubleClick={(click) => click.stopPropagation()}
      onBlur={close}
      onKeyDown={(key) => {
        key.stopPropagation();
        if (key.key === 'Enter') close();
        if (key.key === 'Escape') {
          cancelled.current = true;
          close();
        }
      }}
    />
  );
}

export function EventBlock({
  segment,
  event,
  past,
  selected,
  editing,
  dropped,
  active,
  onBegin,
}: {
  segment: EventSegment;
  event: CalendarEvent;
  past: boolean;
  selected: boolean;
  editing: boolean;
  dropped: boolean;
  active: boolean;
  onBegin: (press: ReactPointerEvent, mode: InteractionMode) => void;
}) {
  const timeFormat = useTimeFormat();
  const setEditing = useAppStore((state) => state.setEditing);
  const displayColor = past ? mutedEventColor(event.color) : event.color;
  const showTime = segment.height >= 38;

  return (
    <div
      data-testid="event-block"
      tabIndex={-1}
      data-event-id={event.id}
      data-selected={selected}
      data-active={active}
      title={`${event.title} · ${formatTimeRange(event, timeFormat)}`}
      className={`event-block absolute cursor-grab overflow-hidden px-1.5 ${cornerClasses(segment)} ${dropped ? 'event-drop' : ''}`}
      style={{
        ...segmentStyle(segment),
        backgroundColor: displayColor,
        color: readableTextColor(displayColor),
        zIndex: active ? 25 : selected ? 20 : 5 + segment.lane,
        touchAction: 'none',
      }}
      onPointerDown={(press) => onBegin(press, 'move')}
      // Plays once: without this, remounting on a view or column change would replay it.
      onAnimationEnd={() => {
        if (dropped) useAppStore.getState().clearDropped();
      }}
      onDoubleClick={(click) => {
        click.stopPropagation();
        setEditing(event.id);
      }}
    >
      {editing ? (
        <TitleEditor event={event} />
      ) : (
        <div className={`pointer-events-none leading-tight ${segment.height < 26 ? 'text-[11px]' : 'pt-1 text-xs'}`}>
          <div data-testid="event-title" className="truncate font-semibold">
            {event.title}
          </div>
          {showTime && (
            <div data-testid="event-time" className="truncate opacity-75 tabular-nums">
              {formatTimeRange(event, timeFormat)}
            </div>
          )}
        </div>
      )}
      {segment.isStart && !editing && (
        <div
          data-testid="resize-start"
          className="absolute inset-x-0 top-0 h-[6px] cursor-ns-resize"
          onPointerDown={(press) => onBegin(press, 'resize-start')}
          onDoubleClick={(click) => click.stopPropagation()}
        />
      )}
      {segment.isEnd && !editing && (
        <div
          data-testid="resize-end"
          className="absolute inset-x-0 bottom-0 h-[6px] cursor-ns-resize"
          onPointerDown={(press) => onBegin(press, 'resize-end')}
          onDoubleClick={(click) => click.stopPropagation()}
        />
      )}
    </div>
  );
}

/** Where a dragged ball would land. */
export function GhostBlock({ segment, event }: { segment: EventSegment; event: GhostEvent }) {
  const timeFormat = useTimeFormat();
  return (
    <div
      data-testid="drop-ghost"
      className={`pointer-events-none absolute z-30 overflow-hidden border-2 border-dashed px-1.5 pt-1 text-xs tabular-nums ${cornerClasses(segment)}`}
      style={{
        top: segment.top,
        height: segment.height,
        left: GAP,
        right: GAP,
        borderColor: event.color,
        backgroundColor: `${event.color}40`,
      }}
    >
      <div className="truncate font-semibold">{event.title}</div>
      <div className="truncate opacity-75">{formatTimeRange(event, timeFormat)}</div>
    </div>
  );
}
