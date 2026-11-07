import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { buildWorkspaceFixture } from '../../test-support/workspaceFixture';
import { startPersistenceSync } from './persistenceSync';
import { loadWorkspace, serialize } from './repository';

const IDS = ['ordinary-id', 'constructor', 'toString', '__proto__'];

describe('TC-06 persistent entity deletion (FR-05, FR-06)', () => {
  beforeEach(() => useAppStore.getState().reset());

  it.each(IDS)('deleting event %s removes its file and it stays absent after reopening', async (id) => {
    const { backend, files } = buildWorkspaceFixture({
      events: [{
        id,
        templateId: 'coding',
        title: 'Work',
        startAt: '2026-11-02T15:00:00.000Z',
        endAt: '2026-11-02T17:00:00.000Z',
        color: '#E98B87',
      }],
    });
    useAppStore.getState().hydrate(await loadWorkspace(backend), 'fixture');
    expect(Object.hasOwn(useAppStore.getState().events, id)).toBe(true);
    const sync = startPersistenceSync(backend);
    try {
      useAppStore.getState().deleteEvent(id);
      expect(Object.hasOwn(useAppStore.getState().events, id)).toBe(false);
      expect(await sync.flush()).toBe(true);
      expect(files.has(`events/${id}.json`)).toBe(false);
      expect(Object.hasOwn((await loadWorkspace(backend)).events, id)).toBe(false);
    } finally {
      await sync.stop();
    }
  });

  it.each(IDS)('deleting template %s removes its file and it stays absent after reopening', async (id) => {
    const { backend, files } = buildWorkspaceFixture({
      rawFiles: {
        [`templates/${id}.json`]: serialize({ id, name: 'Work', color: '#E98B87', defaultDuration: 120, order: 6 }),
      },
    });
    useAppStore.getState().hydrate(await loadWorkspace(backend), 'fixture');
    expect(Object.hasOwn(useAppStore.getState().templates, id)).toBe(true);
    const sync = startPersistenceSync(backend);
    try {
      useAppStore.getState().deleteTemplate(id);
      expect(Object.hasOwn(useAppStore.getState().templates, id)).toBe(false);
      expect(await sync.flush()).toBe(true);
      expect(files.has(`templates/${id}.json`)).toBe(false);
      expect(Object.hasOwn((await loadWorkspace(backend)).templates, id)).toBe(false);
    } finally {
      await sync.stop();
    }
  });
});
