import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import type { WorkspaceBackend } from './backend';
import { startPersistenceSync } from './persistenceSync';
import { initializeWorkspace, loadWorkspace, serialize, WorkspaceOpenError } from './repository';
import { createWriteQueue } from './writeQueue';

function memoryBackend(seed: Record<string, string> = {}) {
  const files = new Map(Object.entries(seed));
  const backend: WorkspaceBackend = {
    select: async () => null,
    restore: async () => null,
    close: async () => undefined,
    list: async (dir) =>
      [...files.keys()].filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1)),
    read: async (path) => files.get(path) ?? null,
    write: async (path, contents) => void files.set(path, contents),
    remove: async (path) => void files.delete(path),
  };
  return { files, backend };
}

const validEvent = {
  id: 'evt_1',
  templateId: 'coding',
  title: 'Work',
  startAt: '2026-11-02T10:00:00.000Z',
  endAt: '2026-11-02T12:00:00.000Z',
  color: '#E98B87',
};
const meta = serialize({ schemaVersion: 1, name: 'W', createdAt: '2026-11-01T00:00:00.000Z' });

describe('repository', () => {
  it('migrates v1 settings and preserves a disabled magnet on reload', async () => {
    const { backend, files } = memoryBackend({ 'workspace.json': meta, 'settings.json': serialize({ startHour: 8, endHour: 3, pixelsPerMinute: 1, view: 'week', inspectorCollapsed: false }) });
    const loaded = await loadWorkspace(backend);
    expect(loaded.settings.magnetEnabled).toBe(true);
    expect(JSON.parse(files.get('workspace.json')!).schemaVersion).toBe(2);
    await backend.write('settings.json', serialize({ ...loaded.settings, magnetEnabled: false }));
    expect((await loadWorkspace(backend)).settings.magnetEnabled).toBe(false);
  });
  it('round-trips a new workspace', async () => {
    const { backend, files } = memoryBackend();
    const created = await initializeWorkspace(backend, 'Mine');
    expect(files.has('workspace.json')).toBe(true);
    expect(files.has('templates/coding.json')).toBe(true);
    const loaded = await loadWorkspace(backend);
    expect(loaded.meta.name).toBe('Mine');
    expect(loaded.templates).toEqual(created.templates);
    expect(loaded.issues).toEqual([]);
  });

  it('skips malformed entities, reports them, and leaves them untouched', async () => {
    const bad = '{ not json';
    const { backend, files } = memoryBackend({
      'workspace.json': meta,
      'events/evt_1.json': serialize(validEvent),
      'events/bad.json': bad,
      'events/inverted.json': serialize({ ...validEvent, id: 'inverted', endAt: validEvent.startAt }),
      'events/renamed.json': serialize(validEvent),
    });
    const loaded = await loadWorkspace(backend);
    expect(Object.keys(loaded.events)).toEqual(['evt_1']);
    expect(loaded.issues).toHaveLength(3);
    expect(files.get('events/bad.json')).toBe(bad);
  });

  it('refuses a damaged or newer workspace rather than overwriting it', async () => {
    await expect(loadWorkspace(memoryBackend({ 'workspace.json': 'oops' }).backend)).rejects.toBeInstanceOf(
      WorkspaceOpenError,
    );
    const newer = serialize({ schemaVersion: 99, name: 'W', createdAt: '2026-11-01T00:00:00.000Z' });
    await expect(loadWorkspace(memoryBackend({ 'workspace.json': newer }).backend)).rejects.toThrow(/newer/);
    await expect(loadWorkspace(memoryBackend().backend)).rejects.toBeInstanceOf(WorkspaceOpenError);
  });

  it('backs up damaged settings before using defaults', async () => {
    const { backend, files } = memoryBackend({ 'workspace.json': meta, 'settings.json': '{{' });
    const loaded = await loadWorkspace(backend);
    expect(loaded.settings.startHour).toBe(8);
    expect(files.get('settings.corrupt.json')).toBe('{{');
    expect(loaded.issues).toHaveLength(1);
  });
});

describe('write queue', () => {
  it('coalesces changes per path and keeps the latest', async () => {
    const write = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const queue = createWriteQueue({ write, remove }, () => undefined);
    queue.set('a', '1');
    queue.set('a', '2');
    queue.set('b', '1');
    queue.set('b', null);
    await queue.flush();
    expect(write.mock.calls).toEqual([['a', '2']]);
    expect(remove.mock.calls).toEqual([['b']]);
    queue.dispose();
  });

  it('reports failures and retries them on the next flush', async () => {
    const write = vi.fn<(path: string, contents: string) => Promise<void>>();
    write.mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const onResult = vi.fn();
    const queue = createWriteQueue({ write, remove: async () => undefined }, onResult);
    queue.set('a', '1');
    await queue.flush();
    expect(onResult).toHaveBeenLastCalledWith(expect.stringContaining('disk full'));
    await queue.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(null);
    queue.dispose();
  });
});

describe('persistence sync', () => {
  beforeEach(() => useAppStore.getState().reset());

  it('mirrors store changes, including undo, and does not rewrite on hydrate', async () => {
    const { backend, files } = memoryBackend();
    const data = await initializeWorkspace(backend, 'W');
    const writeSpy = vi.spyOn(backend, 'write');
    useAppStore.getState().hydrate(data, '/w');
    const sync = startPersistenceSync(backend);

    await sync.flush();
    expect(writeSpy).not.toHaveBeenCalled();

    const id = useAppStore.getState().createEventFromTemplate('coding', new Date(2026, 10, 2, 9))!;
    await sync.flush();
    expect(files.has(`events/${id}.json`)).toBe(true);

    useAppStore.getState().undo();
    await sync.flush();
    expect(files.has(`events/${id}.json`)).toBe(false);

    useAppStore.getState().redo();
    useAppStore.getState().updateSettings({ view: 'day' });
    await sync.flush();
    expect(files.has(`events/${id}.json`)).toBe(true);
    expect(JSON.parse(files.get('settings.json')!).view).toBe('day');
    await sync.stop();
  });
});
