import { afterEach, expect, it, vi } from 'vitest';
import { loadWorkspace } from '../services/persistence/repository';
import { startPersistenceSync } from '../services/persistence/persistenceSync';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import { useAppStore } from './appStore';
import type { Settings } from '../types';
import { settingsPagePatchSchema } from '../services/persistence/schemas';

afterEach(() => useAppStore.getState().reset());

it.each(['{"magnetEnabled":"true"}', '{"view":"year"}', '{"unknown":1}'])('[TC-20.3][AC-06.3,FR-17,R-11] rejects malformed runtime patch %s without state or writes', async json => {
  const { backend } = buildWorkspaceFixture();
  useAppStore.getState().hydrate(await loadWorkspace(backend), 'temporary-memory-fixture');
  const before = useAppStore.getState().settings;
  const write = vi.spyOn(backend, 'write');
  const sync = startPersistenceSync(backend);
  try {
    useAppStore.getState().updateSettings(JSON.parse(json));
    expect(useAppStore.getState().settings).toBe(before);
    await sync.flush();
    expect(write).not.toHaveBeenCalled();
  } finally { await sync.stop(); }
});

it('[TC-20.3][AC-06.3,FR-17,R-11] invalid startHour is rejected without settings changes or writes', async () => {
  const { backend } = buildWorkspaceFixture();
  useAppStore.getState().hydrate(await loadWorkspace(backend), 'temporary-memory-fixture');
  const before = useAppStore.getState().settings;
  const write = vi.spyOn(backend, 'write');
  const sync = startPersistenceSync(backend);
  try {
    useAppStore.getState().updateSettings({ startHour: -1 });
    expect.soft(useAppStore.getState().settings).toBe(before);
    await sync.flush();
    expect(write).not.toHaveBeenCalled();
  } finally { await sync.stop(); }
});

it.each([
  { startHour: 24 }, { startHour: 0.5 }, { endHour: -1 }, { endHour: 25 }, { endHour: 1.5 },
  { pixelsPerMinute: NaN }, { pixelsPerMinute: Infinity }, { pixelsPerMinute: 0.39 }, { pixelsPerMinute: 4.01 },
] satisfies Partial<Settings>[] )('[TC-20.3][AC-06.3,FR-17,R-11] rejects invalid settings %j with zero writes', async patch => {
  const { backend } = buildWorkspaceFixture();
  useAppStore.getState().hydrate(await loadWorkspace(backend), 'temporary-memory-fixture');
  const before = useAppStore.getState().settings;
  const write = vi.spyOn(backend, 'write');
  const sync = startPersistenceSync(backend);
  try {
    useAppStore.getState().updateSettings(patch);
    expect(useAppStore.getState().settings).toBe(before);
    await sync.flush();
    expect(write).not.toHaveBeenCalled();
  } finally { await sync.stop(); }
});

it.each([0.4, 4])('[TC-20.4][AC-06.2,FR-17,R-11] loads legacy zoom %s without clamping or writes', async pixelsPerMinute => {
  const { backend } = buildWorkspaceFixture({ rawFiles: { 'settings.json': JSON.stringify({
    startHour: 8, endHour: 3, pixelsPerMinute, view: 'week', inspectorCollapsed: false, magnetEnabled: false,
  }) } });
  const write = vi.spyOn(backend, 'write');
  useAppStore.getState().hydrate(await loadWorkspace(backend), 'temporary-memory-fixture');
  const sync = startPersistenceSync(backend);
  try {
    expect(useAppStore.getState().settings.pixelsPerMinute).toBe(pixelsPerMinute);
    useAppStore.getState().updateSettings({ startHour: 7 });
    expect(useAppStore.getState().settings.pixelsPerMinute).toBe(pixelsPerMinute);
    expect(useAppStore.getState().settings.magnetEnabled).toBe(false);
    await sync.flush();
    expect((await loadWorkspace(backend)).settings.pixelsPerMinute).toBe(pixelsPerMinute);
    expect(write).toHaveBeenCalledTimes(1);
  } finally { await sync.stop(); }
});

it('[TC-20.3][AC-06.2,AC-06.3,FR-17,R-11] page zoom accepts both endpoints and rejects out-of-range and non-finite edits', () => {
  for (const value of [0.5, 3]) expect(settingsPagePatchSchema.safeParse({ pixelsPerMinute: value }).success).toBe(true);
  for (const value of [0.49, 3.01, NaN, Infinity]) expect(settingsPagePatchSchema.safeParse({ pixelsPerMinute: value }).success).toBe(false);
  expect(settingsPagePatchSchema.safeParse({ magnetEnabled: 'true' }).success).toBe(false);
});
