import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { buildWorkspaceFixture, FIXTURE_NOW_ISO } from '../../test-support/workspaceFixture';
import { startPersistenceSync } from './persistenceSync';
import { loadWorkspace } from './repository';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

// Expected values come from docs/06-test-plan.md TC-06, not from the implementation.
const EXPECTED_EVENTS = [
  { title: '寫 PRD', templateId: 'coding', startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z', color: '#E98B87' },
  { title: '讀書', templateId: 'study', startAt: '2026-11-03T14:00:00.000Z', endAt: '2026-11-03T15:30:00.000Z', color: '#83B9D0' },
  { title: '休息', templateId: 'rest', startAt: '2026-11-04T19:15:00.000Z', endAt: '2026-11-04T19:45:00.000Z', color: '#E9B96E' },
];
const EXPECTED_TEMPLATE_COLORS: Record<string, string> = {
  coding: '#E98B87',
  study: '#83B9D0',
  exercise: '#A9C98D',
  reading: '#9C91CE',
  rest: '#E9B96E',
  personal: '#E5A5BD',
};

describe('TC-06 重開後一致 (AC-02.1, FR-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(FIXTURE_NOW_ISO));
    useAppStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('3 個事件寫入、關閉、重新載入後逐欄相同，模板與 workspace.json 不變', async () => {
    const { backend, files } = buildWorkspaceFixture();
    const metaBytes = files.get('workspace.json');
    const templateHashes = new Map(
      [...files].filter(([p]) => p.startsWith('templates/')).map(([p, c]) => [p, sha256(c)]),
    );

    useAppStore.getState().hydrate(await loadWorkspace(backend), 'fixture');
    const sync = startPersistenceSync(backend);
    const store = useAppStore.getState();
    for (const e of EXPECTED_EVENTS) {
      const id = store.createEventFromTemplate(e.templateId, new Date(e.startAt))!;
      store.updateEvent(id, { title: e.title, startAt: e.startAt, endAt: e.endAt });
    }
    await sync.stop(); // close: flush, then dispose

    // reopen: a fresh load from the same "disk"
    const reopened = await loadWorkspace(backend);
    const byTitle = Object.values(reopened.events).sort((a, b) => a.startAt.localeCompare(b.startAt));
    expect(byTitle.map(({ title, templateId, startAt, endAt, color }) => ({ title, templateId, startAt, endAt, color }))).toEqual(
      EXPECTED_EVENTS,
    );
    expect([...files.keys()].filter((p) => p.startsWith('events/'))).toHaveLength(3);
    expect(Object.fromEntries(Object.values(reopened.templates).map((t) => [t.id, t.color]))).toEqual(EXPECTED_TEMPLATE_COLORS);
    expect(files.get('workspace.json')).toBe(metaBytes);
    for (const [p, h] of templateHashes) expect(sha256(files.get(p)!)).toBe(h);
    expect(templateHashes.size).toBe(6);
    expect(reopened.issues).toEqual([]);
  });
});
