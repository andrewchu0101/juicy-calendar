import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { buildWorkspaceFixture, FIXTURE_NOW_ISO, type FixtureEvent } from '../../test-support/workspaceFixture';
import { startPersistenceSync } from './persistenceSync';
import { loadWorkspace } from './repository';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

// Two good events (version 2 workspace, six templates come from the fixture builder).
const GOOD_EVENTS: FixtureEvent[] = [
  { id: 'evt_good1', templateId: 'coding', title: '寫 PRD', startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z', color: '#E98B87' },
  { id: 'evt_good2', templateId: 'study', title: '讀書', startAt: '2026-11-03T14:00:00.000Z', endAt: '2026-11-03T15:30:00.000Z', color: '#83B9D0' },
];

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const badEvent = (overrides: Record<string, unknown>) => ({
  id: 'evt_bad',
  templateId: 'coding',
  title: '壞檔',
  startAt: '2026-11-04T00:00:00.000Z',
  endAt: '2026-11-04T01:00:00.000Z',
  color: '#E98B87',
  ...overrides,
});

// Hand-computed from docs/06-test-plan.md TC-07: 7 days = 10080 min, so 10081 min ends 1 minute after day 7.
const BAD_FILES: { label: string; path: string; contents: string }[] = [
  { label: '(a) 無法解析', path: 'events/evt_bad.json', contents: '{not json' },
  {
    label: '(b) 結束等於開始',
    path: 'events/evt_bad.json',
    contents: json(badEvent({ endAt: '2026-11-04T00:00:00.000Z' })),
  },
  {
    label: '(c) 長度 10081 分鐘',
    path: 'events/evt_bad.json',
    contents: json(badEvent({ startAt: '2026-11-02T00:00:00.000Z', endAt: '2026-11-09T00:01:00.000Z' })),
  },
  { label: '(d) 名稱 31 字', path: 'events/evt_bad.json', contents: json(badEvent({ title: '字'.repeat(31) })) },
  { label: '(e) 檔名與 id 不符', path: 'events/evt_other.json', contents: json(badEvent({ id: 'evt_bad' })) },
  { label: '(f) 顏色 red', path: 'events/evt_bad.json', contents: json(badEvent({ color: 'red' })) },
  {
    label: '(g) 模板名稱 31 字（U-11）',
    path: 'templates/long.json',
    contents: json({ id: 'long', name: 'x'.repeat(31), color: '#E98B87', defaultDuration: 60, order: 6 }),
  },
];

describe('TC-07 壞檔略過且不改檔 (AC-02.2, FR-06, NFR-04, R-5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(FIXTURE_NOW_ISO));
    useAppStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('[TC-07][FR-06,R-5] a valid __proto__ event and template load as ordinary entities without changing files', async () => {
    const event = { ...GOOD_EVENTS[0]!, id: '__proto__', templateId: '__proto__' };
    const template = { id: '__proto__', name: 'Valid', color: '#E98B87', defaultDuration: 120, order: 6 };
    const { backend, files } = buildWorkspaceFixture({
      events: [event],
      rawFiles: { 'templates/__proto__.json': json(template) },
    });
    const before = new Map(files);

    const data = await loadWorkspace(backend);

    expect(Object.values(data.events)).toEqual([event]);
    expect(Object.values(data.templates)).toContainEqual(template);
    expect(data.issues).toEqual([]);
    expect(files).toEqual(before);
  });

  it('[TC-07][FR-06,R-5,AGENTS-9] skips a 30-second event, accepts exactly one minute, and writes nothing', async () => {
    const minute = { ...GOOD_EVENTS[0]!, id: 'minute', endAt: '2026-11-02T15:31:00.000Z' };
    const short = { ...GOOD_EVENTS[0]!, id: 'short', endAt: '2026-11-02T15:30:30.000Z' };
    const { backend, files } = buildWorkspaceFixture({ events: [minute, short] });
    const before = new Map(files);
    const write = vi.spyOn(backend, 'write');
    const remove = vi.spyOn(backend, 'remove');

    const data = await loadWorkspace(backend);

    expect(Object.values(data.events)).toEqual([minute]);
    expect(data.issues).toEqual([{ code: 'FILE_SKIPPED', file: 'events/short.json', detail: expect.any(String) }]);
    expect(files).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(BAD_FILES)('$label：開啟成功、2 個好事件、通知該檔、檔案不變、載入時 events/ 零寫入', async ({ path, contents }) => {
    const { backend, files } = buildWorkspaceFixture({ events: GOOD_EVENTS, rawFiles: { [path]: contents } });
    const hashBefore = sha256(contents);
    const writes: string[] = [];
    const recording = { ...backend, write: async (p: string, c: string) => (writes.push(p), backend.write(p, c)) };

    const data = await loadWorkspace(recording);

    expect(Object.keys(data.events).sort()).toEqual(['evt_good1', 'evt_good2']);
    expect(Object.keys(data.templates)).toHaveLength(6);
    expect(data.issues).toHaveLength(1);
    expect(data.issues[0]).toMatchObject({ code: 'FILE_SKIPPED', file: path });
    expect(data.issues[0]).toHaveProperty('detail', expect.stringMatching(/\S/));
    expect(sha256(files.get(path)!)).toBe(hashBefore);
    expect(writes.filter((p) => p.startsWith('events/'))).toEqual([]);
  });

  it.each(BAD_FILES)('$label：編輯一個好事件並關閉後，只有該事件的檔案改變，壞檔雜湊仍不變', async ({ path, contents }) => {
    const { backend, files } = buildWorkspaceFixture({ events: GOOD_EVENTS, rawFiles: { [path]: contents } });
    const before = new Map([...files].map(([p, c]) => [p, sha256(c)]));

    useAppStore.getState().hydrate(await loadWorkspace(backend), 'fixture');
    const sync = startPersistenceSync(backend);
    useAppStore.getState().updateEvent('evt_good1', { title: '改過的名稱' });
    await sync.stop();

    const after = new Map([...files].map(([p, c]) => [p, sha256(c)]));
    const changed = [...after].filter(([p, h]) => before.get(p) !== h).map(([p]) => p);
    expect(changed).toEqual(['events/evt_good1.json']);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    expect(JSON.parse(files.get('events/evt_good1.json')!).title).toBe('改過的名稱');
    expect(after.get(path)).toBe(before.get(path));
  });
});
