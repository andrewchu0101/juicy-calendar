import { afterEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { backend } from '../persistence/backend';
import { loadWorkspace } from '../persistence/repository';
import { closeWorkspace, flushWorkspace, selectWorkspace } from './workspaceSession';

vi.mock('../persistence/backend', async () => {
  const { buildWorkspaceFixture } = await import('../../test-support/workspaceFixture');
  return { backend: buildWorkspaceFixture().backend };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('[TC-06][AC-02.1,FR-05,R-4] a failed close preserves unsaved edits and keeps later edits subscribed until recovery', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T17:00:00.000Z'));
  vi.spyOn(backend, 'select').mockResolvedValue({ path: 'fixture', initialized: true });
  await selectWorkspace('open');
  const originalWrite = backend.write;
  const write = vi.spyOn(backend, 'write').mockRejectedValue(new Error('disk full'));
  const id = useAppStore.getState().createEventFromTemplate('coding', new Date('2026-11-02T15:30:00.000Z'))!;

  await closeWorkspace();

  expect(useAppStore.getState().workspacePath).toBe('fixture');
  expect(useAppStore.getState().events[id]?.title).toBe('Coding');
  expect(useAppStore.getState().saveError?.code).toBe('SAVE_FAILED');
  expect(await flushWorkspace()).toBe(false);
  expect((await loadWorkspace(backend)).events[id]).toBeUndefined();

  write.mockImplementation(originalWrite);
  expect(await flushWorkspace()).toBe(true);
  expect((await loadWorkspace(backend)).events[id]?.title).toBe('Coding');
  useAppStore.getState().updateEvent(id, { title: 'Recovered' });
  await closeWorkspace();
  expect(useAppStore.getState().workspacePath).toBeNull();
  expect((await loadWorkspace(backend)).events[id]?.title).toBe('Recovered');
});

it('[TC-06][AC-02.1,FR-05,R-4] a native close failure never leaves an editable workspace with saving disconnected', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T17:00:00.000Z'));
  vi.spyOn(backend, 'select').mockResolvedValue({ path: 'fixture', initialized: true });
  await selectWorkspace('open');
  const id = useAppStore.getState().createEventFromTemplate('coding', new Date('2026-11-02T15:30:00.000Z'))!;
  expect(await flushWorkspace()).toBe(true);
  const nativeClose = vi.spyOn(backend, 'close').mockRejectedValueOnce(new Error('cannot remove remembered workspace'));

  // Accept either a reported rejection or handled failure. The invariant is that an editable
  // workspace must still save changes; a safe transition out of the workspace is also allowed.
  await closeWorkspace().catch(() => undefined);

  try {
    expect(useAppStore.getState().saveError?.code).toBe('SAVE_FAILED');
    if (useAppStore.getState().workspacePath !== null) {
      expect(useAppStore.getState().updateEvent(id, { title: 'Edited after close failed' })).toBe(true);
      expect(await flushWorkspace()).toBe(true);
      expect((await loadWorkspace(backend)).events[id]?.title).toBe('Edited after close failed');
    }
  } finally {
    nativeClose.mockRestore();
    await closeWorkspace();
  }
});

it('[TC-06][FR-05,FR-07,R-4] edits cannot be accepted while native close is still pending', async () => {
  vi.spyOn(backend, 'select').mockResolvedValue({ path: 'fixture', initialized: true });
  await selectWorkspace('open');
  const id = useAppStore.getState().createEventFromTemplate('coding', new Date('2026-11-02T15:30:00.000Z'))!;
  useAppStore.getState().select(id);
  expect(await flushWorkspace()).toBe(true);
  let finishClose = () => undefined as void;
  const closePending = new Promise<void>((resolve) => { finishClose = resolve; });
  const nativeClose = vi.spyOn(backend, 'close').mockReturnValue(closePending);
  const closing = closeWorkspace();
  await vi.waitFor(() => expect(nativeClose).toHaveBeenCalledOnce());
  const before = useAppStore.getState();

  try {
    expect(before.updateEvent(id, { title: 'Lost while closing' })).toBe(false);
    expect(before.createEventFromTemplate('coding', new Date('2026-11-03T15:30:00.000Z'))).toBeNull();
    expect(before.moveEvents({ [id]: { startAt: '2026-11-03T15:30:00.000Z', endAt: '2026-11-03T17:30:00.000Z' } })).toBe(false);
    expect(before.saveTemplate({ name: 'Lost template', color: '#E98B87', defaultDuration: 120 })).toBe(false);
    before.deleteEvent(id);
    before.deleteSelected();
    before.deleteTemplate('coding');
    before.undo();
    before.redo();
    before.updateSettings({ view: 'day' });
    before.openDay(new Date('2026-11-04T00:00:00.000Z'));
    const after = useAppStore.getState();
    expect(after.events).toBe(before.events);
    expect(after.templates).toBe(before.templates);
    expect(after.settings).toBe(before.settings);
    expect(after.past).toBe(before.past);
    expect(after.future).toBe(before.future);
  } finally {
    finishClose();
    await closing;
  }
});
