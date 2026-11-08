import { afterEach, expect, it, vi } from 'vitest';
import { loadWorkspace } from '../services/persistence/repository';
import { startPersistenceSync } from '../services/persistence/persistenceSync';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import { useAppStore } from './appStore';

afterEach(() => { useAppStore.getState().reset(); });

it('[TC-19][AC-05.1,FR-15] copies a multi-selection as one undoable batch, preserving snapshot times and source files', async () => {
  const a = {
    id: 'a', templateId: 'coding', title: 'A', color: '#E98B87',
    startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T18:00:00.000Z',
  };
  const b = {
    id: 'b', templateId: 'study', title: 'B', color: '#83B9D0',
    startAt: '2026-11-03T19:00:00.000Z', endAt: '2026-11-03T20:00:00.000Z',
  };
  const { backend, files } = buildWorkspaceFixture({ events: [a, b] });
  const store = () => useAppStore.getState();
  store().reset();
  store().hydrate(await loadWorkspace(backend), 'fixture');
  store().selectMany(['b', 'a']); // The earliest start wins, not the selection order.
  const write = vi.spyOn(backend, 'write');
  const remove = vi.spyOn(backend, 'remove');
  const sync = startPersistenceSync(backend);
  try {
    const originalFiles = new Map(files);
    expect(store().copySelected()).toBe(true);
    expect(await sync.flush()).toBe(true);
    expect(store().past).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(store().pasteCopied(new Date('2026-11-04T16:00:00.000Z'))).toBe(true);
    const copies = Object.values(store().events).filter(event => !['a', 'b'].includes(event.id));
    expect(copies).toHaveLength(2);
    expect(copies.find(event => event.title === 'A')).toEqual({
      ...a, id: expect.any(String), startAt: '2026-11-04T16:00:00.000Z', endAt: '2026-11-04T18:30:00.000Z',
    });
    expect(copies.find(event => event.title === 'B')).toEqual({
      ...b, id: expect.any(String), startAt: '2026-11-05T19:30:00.000Z', endAt: '2026-11-05T20:30:00.000Z',
    });
    expect([...store().selectedEventIds].sort()).toEqual(copies.map(event => event.id).sort());
    expect(store().past).toHaveLength(1);
    expect(await sync.flush()).toBe(true);
    for (const [path, bytes] of originalFiles) expect(files.get(path)).toBe(bytes);
    const pasted = structuredClone(store().events);
    expect((await loadWorkspace(backend)).events).toEqual(pasted);
    store().undo();
    expect(store().events).toEqual({ a, b });
    store().redo();
    expect(store().events).toEqual(pasted);
  } finally {
    await sync.stop();
  }
});

const snapshotSource = {
  id: 'source', templateId: 'deleted-template', title: 'Original', color: '#83B9D0',
  startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T18:00:00.000Z',
};

async function snapshotFixture() {
  const fixture = buildWorkspaceFixture({ events: [snapshotSource] });
  useAppStore.getState().reset();
  useAppStore.getState().hydrate(await loadWorkspace(fixture.backend), 'fixture');
  useAppStore.getState().select('source');
  return fixture;
}

it('[TC-19][AC-05.2,FR-16] keeps an independent snapshot after editing and deleting the source, and generates new ids per paste', async () => {
  await snapshotFixture();
  const store = () => useAppStore.getState();
  expect(store().copySelected()).toBe(true);
  store().updateEvent('source', { title: 'Changed', color: '#FFFFFF' });
  store().deleteEvent('source');
  expect(store().pasteCopied(new Date('2026-11-02T15:30:00.000Z'))).toBe(true);
  const first = Object.values(store().events)[0]!;
  expect(first).toEqual({ ...snapshotSource, id: expect.any(String) });
  expect(first.id).not.toBe(snapshotSource.id);
  expect(store().pasteCopied(new Date('2026-11-02T15:30:00.000Z'))).toBe(true);
  const copies = Object.values(store().events);
  expect(copies).toHaveLength(2); // Overlap is allowed.
  expect(new Set(copies.map(event => event.id)).size).toBe(2);
});

it.each(['empty', 'invalid-date', 'overflow', 'closing', 'no-workspace', 'invalid-batch'] as const)(
  '[TC-19][AC-05.3,R-10] rejects %s without changing events, selection, history, queue or files', async reason => {
    const { backend, files } = await snapshotFixture();
    const store = () => useAppStore.getState();
    if (reason !== 'empty') expect(store().copySelected()).toBe(true);
    if (reason === 'closing') store().setWorkspaceClosing(true);
    if (reason === 'no-workspace') useAppStore.setState({ workspacePath: null });
    if (reason === 'invalid-batch') useAppStore.setState({ copiedEvents: [snapshotSource, { ...snapshotSource, title: '' }] });
    const before = store();
    const disk = new Map(files);
    const write = vi.spyOn(backend, 'write');
    const remove = vi.spyOn(backend, 'remove');
    const sync = startPersistenceSync(backend);
    try {
      const target = reason === 'invalid-date' ? new Date(NaN)
        : reason === 'overflow' ? new Date(8.64e15) : new Date('2026-11-04T16:00:00.000Z');
      expect(store().pasteCopied(target)).toBe(false);
      expect(store()).toBe(before); // No store notification means no diff enters the queue.
      expect(await sync.flush()).toBe(true);
      expect(files).toEqual(disk);
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    } finally { await sync.stop(); }
  },
);

it('[TC-19][AC-05.2,FR-16] clears the clipboard on reset and hydration of another workspace', async () => {
  const { backend } = await snapshotFixture();
  const store = () => useAppStore.getState();
  expect(store().copySelected()).toBe(true);
  store().reset();
  expect(store().copiedEvents).toEqual([]);
  store().hydrate(await loadWorkspace(backend), 'fixture');
  store().select('source');
  expect(store().copySelected()).toBe(true);
  store().hydrate(await loadWorkspace(backend), 'other-workspace');
  expect(store().copiedEvents).toEqual([]);
  expect(store().pasteCopied(new Date('2026-11-04T16:00:00.000Z'))).toBe(false);
});

it('[TC-19][AC-05.1,R-10] preserves seven elapsed days across DST and allows a copy beyond visible dates', async () => {
  await snapshotFixture();
  const store = () => useAppStore.getState();
  useAppStore.setState({ copiedEvents: [{
    ...snapshotSource, startAt: '2026-10-30T23:00:00.000Z', endAt: '2026-11-06T23:00:00.000Z',
  }] });
  expect(store().pasteCopied(new Date('2026-11-01T03:00:00.000Z'))).toBe(true);
  const copy = Object.values(store().events).find(event => event.id !== 'source')!;
  expect(copy.startAt).toBe('2026-11-01T03:00:00.000Z');
  expect(copy.endAt).toBe('2026-11-08T03:00:00.000Z');
});
