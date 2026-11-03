import { create } from 'zustand';
import { newEventTimes, shiftAnchor, type EventTimes } from '../features/calendar/engine';
import { DEFAULT_SETTINGS } from '../services/persistence/schemas';
import type { WorkspaceData } from '../services/persistence/repository';
import type { CalendarEvent, Settings, Template } from '../types';

const HISTORY_LIMIT = 100;

type EventMap = Record<string, CalendarEvent>;
type TemplateMap = Record<string, Template>;
export type EventPatch = Partial<Pick<CalendarEvent, 'title' | 'color' | 'startAt' | 'endAt'>>;

export type AppState = {
  booted: boolean;
  workspacePath: string | null;
  workspaceName: string;
  openError: string | null;
  saveError: string | null;
  issues: string[];

  templates: TemplateMap;
  events: EventMap;
  settings: Settings;
  /** The date the calendar is showing, as an ISO instant. */
  anchor: string;
  selectedEventId: string | null;
  editingEventId: string | null;
  /** The event that should play the drop animation. */
  droppedEventId: string | null;
  past: EventMap[];
  future: EventMap[];

  setBooted(): void;
  setOpenError(error: string | null): void;
  setSaveError(error: string | null): void;
  dismissIssues(): void;
  hydrate(data: WorkspaceData, path: string): void;
  reset(): void;

  createEventFromTemplate(templateId: string, start: Date): string | null;
  updateEvent(id: string, patch: EventPatch | EventTimes): void;
  deleteEvent(id: string): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  setEditing(id: string | null): void;
  clearDropped(): void;

  saveTemplate(template: Omit<Template, 'id' | 'order'> & { id?: string }): void;
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
  issues: [] as string[],
  templates: {} as TemplateMap,
  events: {} as EventMap,
  settings: DEFAULT_SETTINGS,
  selectedEventId: null,
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
    const { selectedEventId } = get();
    set({
      events,
      past,
      future,
      editingEventId: null,
      droppedEventId: null,
      selectedEventId: selectedEventId && events[selectedEventId] ? selectedEventId : null,
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
        { selectedEventId: null, editingEventId: null, droppedEventId: event.id },
      );
      return event.id;
    },

    updateEvent: (id, patch) => {
      const event = get().events[id];
      if (!event) return;
      const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((key) => event[key] !== patch[key]);
      if (changed) commit({ ...get().events, [id]: { ...event, ...patch } });
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
        editingEventId: state.editingEventId === id ? id : null,
      })),
    setEditing: (id) => set(id ? { editingEventId: id, selectedEventId: id } : { editingEventId: null }),

    clearDropped: () => set({ droppedEventId: null }),

    saveTemplate: ({ id, ...fields }) => {
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
