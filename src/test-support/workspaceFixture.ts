/**
 * Test-only. Builds an in-memory workspace (format version 2, six default templates) from fixed
 * literals. Nothing here is imported by product code, so it never reaches the packaged app.
 * Values are written out on purpose instead of calling the product's seed code, so expectations
 * stay independent of the implementation.
 */
import type { AppSettings, WorkspaceBackend } from '../services/persistence/backend';

/** Fixed clock: Monday 2026-11-02 12:00 EST, time zone America/New_York. */
export const FIXTURE_NOW_ISO = '2026-11-02T17:00:00.000Z';

export type FixtureEvent = {
  id: string;
  templateId: string;
  title: string;
  startAt: string;
  endAt: string;
  color: string;
};

export type WorkspaceFixture = {
  backend: WorkspaceBackend;
  /** Live view of the in-memory "disk": workspace-relative path -> contents. */
  files: Map<string, string>;
};

export type FixtureOptions = {
  /** Valid events to add under events/<id>.json. */
  events?: FixtureEvent[];
  /** Extra raw files (for example damaged ones), written exactly as given. */
  rawFiles?: Record<string, string>;
};

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const TEMPLATES = [
  { id: 'coding', name: 'Coding', color: '#E98B87', defaultDuration: 120, order: 0 },
  { id: 'study', name: 'Study', color: '#83B9D0', defaultDuration: 90, order: 1 },
  { id: 'exercise', name: 'Exercise', color: '#A9C98D', defaultDuration: 60, order: 2 },
  { id: 'reading', name: 'Reading', color: '#9C91CE', defaultDuration: 45, order: 3 },
  { id: 'rest', name: 'Rest', color: '#E9B96E', defaultDuration: 30, order: 4 },
  { id: 'personal', name: 'Personal', color: '#E5A5BD', defaultDuration: 60, order: 5 },
];

export function buildWorkspaceFixture(options: FixtureOptions = {}): WorkspaceFixture {
  const files = new Map<string, string>();
  files.set('workspace.json', json({ schemaVersion: 2, name: 'Fixture', createdAt: FIXTURE_NOW_ISO }));
  files.set(
    'settings.json',
    json({ startHour: 8, endHour: 3, pixelsPerMinute: 1, view: 'week', inspectorCollapsed: false, magnetEnabled: true }),
  );
  for (const template of TEMPLATES) files.set(`templates/${template.id}.json`, json(template));
  for (const event of options.events ?? []) files.set(`events/${event.id}.json`, json(event));
  for (const [path, contents] of Object.entries(options.rawFiles ?? {})) files.set(path, contents);

  let language: AppSettings['language'] = null;
  const backend: WorkspaceBackend = {
    select: async () => null,
    restore: async () => null,
    close: async () => undefined,
    list: async (dir) =>
      [...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)),
    read: async (path) => files.get(path) ?? null,
    write: async (path, contents) => void files.set(path, contents),
    remove: async (path) => void files.delete(path),
    readAppSettings: async () => ({ language }),
    writeAppSettings: async (settings) => void (language = settings.language),
    systemInfo: async () => ({ locale: null, hour12: null }),
  };
  return { backend, files };
}
