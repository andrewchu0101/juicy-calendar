import type { ZodType } from 'zod';
import type { CalendarEvent, Settings, Template, WorkspaceMeta } from '../../types';
import type { WorkspaceBackend } from './backend';
import { DEFAULT_SETTINGS, eventSchema, SCHEMA_VERSION, settingsSchema, templateSchema, workspaceSchema } from './schemas';

export type WorkspaceData = {
  meta: WorkspaceMeta;
  templates: Record<string, Template>;
  events: Record<string, CalendarEvent>;
  settings: Settings;
  /** Problems found while loading. The affected files are left untouched. */
  issues: WorkspaceIssue[];
};

/** `detail` is a diagnostic for logs and tests; the screen shows text chosen by `code` only. */
export type WorkspaceIssue =
  | { code: 'FILE_SKIPPED'; file: string; detail: string }
  | { code: 'SETTINGS_RESET' };

export type WorkspaceOpenErrorCode = 'NO_WORKSPACE_JSON' | 'WORKSPACE_DAMAGED' | 'WORKSPACE_TOO_NEW';

/** Why a workspace was refused. `message` is for logs and tests; the screen shows text chosen by `code`. */
export class WorkspaceOpenError extends Error {
  constructor(
    message: string,
    readonly code: WorkspaceOpenErrorCode,
    readonly version?: number,
  ) {
    super(message);
  }
}

export function templatePath(id: string): string {
  return `templates/${id}.json`;
}

export function eventPath(id: string): string {
  return `events/${id}.json`;
}

export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseWith<T>(raw: string, schema: ZodType<T>): T | null {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function skipReason<T>(raw: string, schema: ZodType<T>): string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return 'invalid JSON';
  }
  const result = schema.safeParse(value);
  if (result.success) return 'file name does not match id';
  return result.error.issues[0]?.message ?? 'invalid content';
}

async function loadEntities<T extends { id: string }>(
  backend: WorkspaceBackend,
  dir: 'templates' | 'events',
  schema: ZodType<T>,
  issues: WorkspaceIssue[],
): Promise<Record<string, T>> {
  // External IDs such as __proto__ must be ordinary own keys, never prototype setters.
  const entities: Record<string, T> = Object.create(null);
  for (const file of await backend.list(dir)) {
    const raw = await backend.read(`${dir}/${file}`);
    if (raw === null) continue;
    const entity = parseWith(raw, schema);
    if (entity && file === `${entity.id}.json`) entities[entity.id] = entity;
    else issues.push({ code: 'FILE_SKIPPED', file: `${dir}/${file}`, detail: skipReason(raw, schema) });
  }
  return entities;
}

export async function loadWorkspace(backend: WorkspaceBackend): Promise<WorkspaceData> {
  const rawMeta = await backend.read('workspace.json');
  if (rawMeta === null) throw new WorkspaceOpenError('This folder has no workspace.json.', 'NO_WORKSPACE_JSON');
  const meta = parseWith(rawMeta, workspaceSchema);
  if (!meta) {
    throw new WorkspaceOpenError('workspace.json is damaged, so the workspace was not opened.', 'WORKSPACE_DAMAGED');
  }
  if (meta.schemaVersion > SCHEMA_VERSION) {
    throw new WorkspaceOpenError(
      `This workspace uses format ${meta.schemaVersion}, newer than this app supports (${SCHEMA_VERSION}).`,
      'WORKSPACE_TOO_NEW',
      meta.schemaVersion,
    );
  }

  const issues: WorkspaceIssue[] = [];
  const templates = await loadEntities(backend, 'templates', templateSchema, issues);
  const events = await loadEntities(backend, 'events', eventSchema, issues);

  let settings = DEFAULT_SETTINGS;
  const rawSettings = await backend.read('settings.json');
  if (rawSettings !== null) {
    const parsed = parseWith(rawSettings, settingsSchema);
    if (parsed) {
      settings = parsed;
    } else {
      await backend.write('settings.corrupt.json', rawSettings);
      issues.push({ code: 'SETTINGS_RESET' });
    }
  }
  if (meta.schemaVersion < SCHEMA_VERSION) {
    // Write the compatible settings first; advance the version only after success.
    await backend.write('settings.json', serialize(settings));
    meta.schemaVersion = SCHEMA_VERSION;
    await backend.write('workspace.json', serialize(meta));
  }
  return { meta, templates, events, settings, issues };
}

const SEED_TEMPLATES: Omit<Template, 'order'>[] = [
  { id: 'coding', name: 'Coding', color: '#E98B87', defaultDuration: 120 },
  { id: 'study', name: 'Study', color: '#83B9D0', defaultDuration: 90 },
  { id: 'exercise', name: 'Exercise', color: '#A9C98D', defaultDuration: 60 },
  { id: 'reading', name: 'Reading', color: '#9C91CE', defaultDuration: 45 },
  { id: 'rest', name: 'Rest', color: '#E9B96E', defaultDuration: 30 },
  { id: 'personal', name: 'Personal', color: '#E5A5BD', defaultDuration: 60 },
];

/** Creates a new workspace. Never called for a folder that already has a workspace.json. */
export async function initializeWorkspace(backend: WorkspaceBackend, name: string): Promise<WorkspaceData> {
  const meta: WorkspaceMeta = { schemaVersion: SCHEMA_VERSION, name, createdAt: new Date().toISOString() };
  const templates: Record<string, Template> = {};
  for (const [order, seed] of SEED_TEMPLATES.entries()) {
    const template = { ...seed, order };
    templates[template.id] = template;
    await backend.write(templatePath(template.id), serialize(template));
  }
  await backend.write('settings.json', serialize(DEFAULT_SETTINGS));
  // Written last: a folder only counts as a workspace once its contents are complete.
  await backend.write('workspace.json', serialize(meta));
  return { meta, templates, events: {}, settings: DEFAULT_SETTINGS, issues: [] };
}
