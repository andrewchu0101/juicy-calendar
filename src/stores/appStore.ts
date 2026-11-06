import { create } from 'zustand';
import { newEventTimes, shiftAnchor, validateTitle, type EventTimes } from '../features/calendar/engine';
import { DEFAULT_SETTINGS } from '../services/persistence/schemas';
import type { OpenErrorState, SaveErrorState } from '../services/notices/notices';
import type { WorkspaceData, WorkspaceIssue } from '../services/persistence/repository';
import type { CalendarEvent, Settings, Template } from '../types';

const HISTORY_LIMIT = 100;

type EventMap = Record<string, CalendarEvent>;
type TemplateMap = Record<string, Template>;
export type EventPatch = Partial<Pick<CalendarEvent, 'title' | 'color' | 'startAt' | 'endAt'>>;

export type AppState = {
  booted: boolean;
  workspacePath: string | null;
  workspaceName: string;
  openError: OpenErrorState | null;
  saveError: SaveErrorState | null;
  issues: WorkspaceIssue[];

  templates: TemplateMap;
  events: EventMap;
  settings: Settings;
  /** The date the calendar is showing, as an ISO instant. */
  anchor: string;
  selectedEventId: string | null;
  /** 兩個以上區塊被選中時的代號；此時 selectedEventId 為 null（SRS R-9）。 */
  selectedEventIds: string[];
  editingEventId: string | null;
  /** The event that should play the drop animation. */
  droppedEventId: string | null;
  past: EventMap[];
  future: EventMap[];

  setBooted(): void;
  setOpenError(error: OpenErrorState | null): void;
  setSaveError(error: SaveErrorState | null): void;
  dismissIssues(): void;
  hydrate(data: WorkspaceData, path: string): void;
  reset(): void;

  createEventFromTemplate(templateId: string, start: Date): string | null;
  /** 回傳 false 表示被拒絕（找不到事件或名稱不合法），此時資料完全不變。 */
  updateEvent(id: string, patch: EventPatch | EventTimes): boolean;
  /** 整批移動（SRS R-9）：一次提交、一次復原。有任何一個代號不是事件就整批拒絕並回傳 false，資料完全不變。 */
  moveEvents(changes: Record<string, EventTimes>): boolean;
  deleteEvent(id: string): void;
  /** 刪除所有選中的區塊（單選或多選），一次提交、一次復原；沒有選取時什麼都不做。 */
  deleteSelected(): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  /** 0 個＝清除、1 個＝單選、2 個以上＝多選。不存在的代號會被忽略。 */
  selectMany(ids: string[]): void;
  setEditing(id: string | null): void;
  clearDropped(): void;

  /** 回傳 false 表示名稱不合法而被拒絕，此時資料完全不變。 */
  saveTemplate(template: Omit<Template, 'id' | 'order'> & { id?: string }): boolean;
  deleteTemplate(id: string): void;

  updateSettings(patch: Partial<Settings>): void;
  navigate(direction: 1 | -1): void;
  goToday(): void;
  openDay(day: Date): void;
};

const initial = {
  workspacePath: null,
  workspaceName: '',
  saveError: null,
  issues: [] as WorkspaceIssue[],
  templates: {} as TemplateMap,
  events: {} as EventMap,
  settings: DEFAULT_SETTINGS,
  selectedEventId: null,
  selectedEventIds: [] as string[],
  editingEventId: null,
  droppedEventId: null,
  past: [] as EventMap[],
  future: [] as EventMap[],
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function makeTemplateId(name: string, existing: TemplateMap): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug && !(slug in existing) ? slug : makeId('tpl');
}

export const useAppStore = create<AppState>((set, get) => {
  /** Applies a change to events as one undoable step. */
  const commit = (next: EventMap, extra: Partial<AppState> = {}) => {
    set((state) => ({
      events: next,
      past: [...state.past, state.events].slice(-HISTORY_LIMIT),
      future: [],
      ...extra,
    }));
  };

  /** Selection and editing must not point at an event that history just removed. */
  const restore = (events: EventMap, past: EventMap[], future: EventMap[]) => {
    const { selectedEventId, selectedEventIds } = get();
    const alive = selectedEventIds.filter((id) => events[id]);
    set({
      events,
      past,
      future,
      editingEventId: null,
      droppedEventId: null,
      ...(alive.length >= 2
        ? { selectedEventId: null, selectedEventIds: alive }
        : { selectedEventId: alive[0] ?? (selectedEventId && events[selectedEventId] ? selectedEventId : null), selectedEventIds: [] }),
    });
  };

  return {
    ...initial,
    booted: false,
    openError: null,
    anchor: new Date().toISOString(),

    setBooted: () => set({ booted: true }),
    setOpenError: (openError) => set({ openError }),
    setSaveError: (saveError) => set({ saveError }),
    dismissIssues: () => set({ issues: [] }),

    hydrate: (data, path) =>
      set({
        ...initial,
        workspacePath: path,
        workspaceName: data.meta.name,
        templates: data.templates,
        events: data.events,
        settings: data.settings,
        issues: data.issues,
        openError: null,
      }),
    reset: () => set({ ...initial }),

    createEventFromTemplate: (templateId, start) => {
      const template = get().templates[templateId];
      if (!template) return null;
      const event: CalendarEvent = {
        id: makeId('evt'),
        templateId,
        title: template.name,
        color: template.color,
        ...newEventTimes(start),
      };
      commit(
        { ...get().events, [event.id]: event },
        { selectedEventId: null, selectedEventIds: [], editingEventId: null, droppedEventId: event.id },
      );
      return event.id;
    },

    updateEvent: (id, rawPatch) => {
      const event = get().events[id];
      if (!event) return false;
      let patch = rawPatch;
      if ('title' in rawPatch && rawPatch.title !== undefined) {
        const title = validateTitle(rawPatch.title);
        if (title === null) return false;
        patch = { ...rawPatch, title };
      }
      const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((key) => event[key] !== patch[key]);
      if (changed) commit({ ...get().events, [id]: { ...event, ...patch } });
      return true;
    },

    moveEvents: (changes) => {
      const { events } = get();
      const ids = Object.keys(changes);
      if (ids.length === 0 || ids.some((id) => !events[id])) return false;
      const next = { ...events };
      for (const id of ids) next[id] = { ...events[id]!, ...changes[id]! };
      commit(next);
      return true;
    },

    deleteSelected: () => {
      const { events, selectedEventId, selectedEventIds } = get();
      const doomed = selectedEventIds.length > 0 ? selectedEventIds : selectedEventId ? [selectedEventId] : [];
      const next = { ...events };
      let removed = 0;
      for (const id of doomed) if (next[id]) { delete next[id]; removed += 1; }
      if (removed === 0) return;
      commit(next, { selectedEventId: null, selectedEventIds: [], editingEventId: null });
    },

    deleteEvent: (id) => {
      const { events, selectedEventId } = get();
      if (!events[id]) return;
      const { [id]: _removed, ...rest } = events;
      commit(rest, {
        selectedEventId: selectedEventId === id ? null : selectedEventId,
        editingEventId: null,
      });
    },

    undo: () => {
      const { past, future, events } = get();
      const previous = past.at(-1);
      if (previous) restore(previous, past.slice(0, -1), [...future, events]);
    },

    redo: () => {
      const { past, future, events } = get();
      const next = future.at(-1);
      if (next) restore(next, [...past, events], future.slice(0, -1));
    },

    select: (id) =>
      set((state) => ({
        selectedEventId: id,
        selectedEventIds: [],
        editingEventId: state.editingEventId === id ? id : null,
      })),
    selectMany: (ids) => {
      const { events } = get();
      const valid = [...new Set(ids)].filter((id) => events[id]);
      if (valid.length >= 2) set({ selectedEventId: null, selectedEventIds: valid, editingEventId: null });
      else set({ selectedEventId: valid[0] ?? null, selectedEventIds: [], editingEventId: null });
    },
    setEditing: (id) => set(id ? { editingEventId: id, selectedEventId: id, selectedEventIds: [] } : { editingEventId: null }),

    clearDropped: () => set({ droppedEventId: null }),

    saveTemplate: ({ id, ...rawFields }) => {
      const name = validateTitle(rawFields.name);
      if (name === null) return false;
      const fields = { ...rawFields, name };
      const { templates } = get();
      const existing = id ? templates[id] : undefined;
      const template: Template = existing
        ? { ...existing, ...fields }
        : {
            ...fields,
            id: makeTemplateId(fields.name, templates),
            order: Math.max(-1, ...Object.values(templates).map((item) => item.order)) + 1,
          };
      set({ templates: { ...templates, [template.id]: template } });
      return true;
    },

    deleteTemplate: (id) => {
      const { [id]: _removed, ...rest } = get().templates;
      set({ templates: rest });
    },

    updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    navigate: (direction) =>
      set((state) => ({
        anchor: shiftAnchor(state.settings.view, new Date(state.anchor), direction).toISOString(),
      })),
    goToday: () => set({ anchor: new Date().toISOString() }),
    openDay: (day) =>
      set((state) => ({
        anchor: day.toISOString(),
        settings: { ...state.settings, view: 'day' },
      })),
  };
});

export function sortedTemplates(templates: TemplateMap): Template[] {
  return Object.values(templates).sort((a, b) => a.order - b.order);
}
