import { beforeEach, describe, expect, it } from 'vitest';
import { startPersistenceSync } from '../services/persistence/persistenceSync';
import { loadWorkspace } from '../services/persistence/repository';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import { useAppStore } from './appStore';

// 預期值來自 docs/06-test-plan.md TC-03 與 AGENTS.md「本專案」第 9、10 條。
const store = () => useAppStore.getState();
const THIRTY_ONE = '字'.repeat(31);

async function setup() {
  const { backend, files } = buildWorkspaceFixture();
  const writes: string[] = [];
  const spied = { ...backend, write: async (path: string, contents: string) => { writes.push(path); await backend.write(path, contents); } };
  useAppStore.getState().reset();
  store().hydrate(await loadWorkspace(spied), 'fixture');
  const sync = startPersistenceSync(spied);
  const id = store().createEventFromTemplate('coding', new Date('2026-11-02T15:30:00.000Z'))!;
  await sync.flush();
  writes.length = 0; // 只看之後的寫入
  return { sync, id, writes, files };
}

describe('[TC-03][AC-01.3,FR-02,R-3] store 的事件名稱規則', () => {
  beforeEach(() => useAppStore.getState().reset());

  it.each([
    ['31 個字', THIRTY_ONE],
    ['空字串', ''],
    ['全空白', '   '],
  ])('拒絕 %s：事件逐欄不變、歷史不增加、寫入佇列為 0', async (_name, title) => {
    const { sync, id, writes } = await setup();
    const before = structuredClone(store().events[id]);
    const eventsBefore = store().events;
    const pastBefore = store().past.length;

    store().updateEvent(id, { title });
    await sync.flush();

    expect(store().events[id]).toEqual(before);
    expect(store().events).toBe(eventsBefore);
    expect(store().past).toHaveLength(pastBefore);
    expect(writes).toEqual([]);
    await sync.stop();
  });

  it('接受時存成去空白後的名稱：「  寫 PRD  」→「寫 PRD」並寫檔', async () => {
    const { sync, id, writes } = await setup();
    store().updateEvent(id, { title: '  寫 PRD  ' });
    await sync.flush();
    expect(store().events[id]?.title).toBe('寫 PRD');
    expect(writes).toEqual([`events/${id}.json`]);
    await sync.stop();
  });

  it('名稱與時間一起改時，名稱不合法則整筆拒絕', async () => {
    const { sync, id, writes } = await setup();
    const before = structuredClone(store().events[id]);
    store().updateEvent(id, { title: THIRTY_ONE, endAt: '2026-11-02T18:00:00.000Z' });
    await sync.flush();
    expect(store().events[id]).toEqual(before);
    expect(writes).toEqual([]);
    await sync.stop();
  });
});

describe('[TC-03][U-11,FR-02] store 的模板名稱規則', () => {
  it.each([
    ['31 個字', THIRTY_ONE],
    ['全空白', '   '],
  ])('新增模板拒絕 %s：模板集合不變、沒有寫入', async (_name, name) => {
    const { sync, writes } = await setup();
    const before = store().templates;
    store().saveTemplate({ name, color: '#83B9D0', defaultDuration: 60 });
    await sync.flush();
    expect(store().templates).toBe(before);
    expect(writes).toEqual([]);
    await sync.stop();
  });

  it('改名成 31 個字被拒絕，原模板逐欄不變', async () => {
    const { sync, writes } = await setup();
    const before = structuredClone(store().templates.coding);
    store().saveTemplate({ id: 'coding', name: THIRTY_ONE, color: '#83B9D0', defaultDuration: 60 });
    await sync.flush();
    expect(store().templates.coding).toEqual(before);
    expect(writes).toEqual([]);
    await sync.stop();
  });

  it('30 個字接受，並存成去空白後的名稱', async () => {
    store().saveTemplate({ name: `  ${'字'.repeat(30)}  `, color: '#83B9D0', defaultDuration: 60 });
    const names = Object.values(store().templates).map((t) => t.name);
    expect(names).toContain('字'.repeat(30));
  });
});
