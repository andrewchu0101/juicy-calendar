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
