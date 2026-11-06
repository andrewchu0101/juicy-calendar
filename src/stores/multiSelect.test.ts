import { beforeEach, describe, expect, it } from 'vitest';
import { loadWorkspace } from '../services/persistence/repository';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import { useAppStore } from './appStore';

// 預期值來自 docs/06-test-plan.md TC-18、PRD US-04、SRS R-9。
const store = () => useAppStore.getState();

/** 建立三個區塊 a、b、c（週一 8:00、10:00、12:00 之後各 120 分鐘），回傳它們的代號。 */
async function setup() {
  const { backend } = buildWorkspaceFixture();
  store().reset();
  store().hydrate(await loadWorkspace(backend), 'fixture');
  const a = store().createEventFromTemplate('coding', new Date('2026-11-02T13:00:00.000Z'))!;
  const b = store().createEventFromTemplate('coding', new Date('2026-11-02T15:00:00.000Z'))!;
  const c = store().createEventFromTemplate('coding', new Date('2026-11-02T17:00:00.000Z'))!;
  return { a, b, c };
}

describe('[TC-18c][AC-04.1,FR-12,R-9] store 的多選狀態', () => {
  beforeEach(() => store().reset());

  it('selectMany with two or more ids selects them all and leaves the single selection empty', async () => {
    const { a, b } = await setup();
    store().selectMany([a, b]);
    expect(store().selectedEventIds).toEqual([a, b]);
    expect(store().selectedEventId).toBeNull();
  });

  it('selectMany with one id is the same as a single selection', async () => {
    const { a } = await setup();
    store().selectMany([a]);
    expect(store().selectedEventId).toBe(a);
    expect(store().selectedEventIds).toEqual([]);
  });

  it('selectMany with no ids, and select(null), clear everything', async () => {
    const { a, b } = await setup();
    store().selectMany([a, b]);
    store().selectMany([]);
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([null, []]);
    store().selectMany([a, b]);
    store().select(null);
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([null, []]);
  });

  it('selecting or editing one event shrinks a multi-selection to that event', async () => {
    const { a, b, c } = await setup();
    store().selectMany([a, b, c]);
    store().select(b);
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([b, []]);
    store().selectMany([a, b, c]);
    store().setEditing(c);
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([c, []]);
  });

  it('ignores ids that are not events', async () => {
    const { a, b } = await setup();
    store().selectMany([a, 'ghost', b]);
    expect(store().selectedEventIds).toEqual([a, b]);
  });

  it('undo drops selected events that no longer exist and falls back to a single selection', async () => {
    const { a, b } = await setup(); // history: create a, create b, create c
    store().selectMany([a, b]);
    store().undo(); // c disappears: a and b stay selected
    expect(store().selectedEventIds).toEqual([a, b]);
    store().undo(); // b disappears
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([a, []]);
  });
});

describe('[TC-18d][AC-04.2,AC-04.4,FR-13,FR-14,R-9] 整批移動與整批刪除是一個可復原步驟', () => {
  beforeEach(() => store().reset());

  it('moveEvents changes every event in one history step, and one undo puts them all back', async () => {
    const { a, b, c } = await setup();
    const before = structuredClone(store().events);
    const pastBefore = store().past.length;
    const moved = store().moveEvents({
      [a]: { startAt: '2026-11-02T14:00:00.000Z', endAt: '2026-11-02T16:00:00.000Z' },
      [b]: { startAt: '2026-11-02T16:00:00.000Z', endAt: '2026-11-02T18:00:00.000Z' },
    });
    expect(moved).toBe(true);
    expect(store().events[a]!.startAt).toBe('2026-11-02T14:00:00.000Z');
    expect(store().events[b]!.endAt).toBe('2026-11-02T18:00:00.000Z');
    expect(store().events[c]).toEqual(before[c]);
    expect(store().past.length).toBe(pastBefore + 1);
    store().undo();
    expect(store().events).toEqual(before);
  });

  it('moveEvents rejects the whole batch when one id is not an event, and nothing changes', async () => {
    const { a } = await setup();
    const before = store().events;
    const pastBefore = store().past.length;
    const moved = store().moveEvents({
      [a]: { startAt: '2026-11-02T14:00:00.000Z', endAt: '2026-11-02T16:00:00.000Z' },
      ghost: { startAt: '2026-11-02T14:00:00.000Z', endAt: '2026-11-02T16:00:00.000Z' },
    });
    expect(moved).toBe(false);
    expect(store().events).toBe(before);
    expect(store().past.length).toBe(pastBefore);
  });

  it('moveEvents keeps the multi-selection', async () => {
    const { a, b } = await setup();
    store().selectMany([a, b]);
    store().moveEvents({
      [a]: { startAt: '2026-11-02T14:00:00.000Z', endAt: '2026-11-02T16:00:00.000Z' },
      [b]: { startAt: '2026-11-02T16:00:00.000Z', endAt: '2026-11-02T18:00:00.000Z' },
    });
    expect(store().selectedEventIds).toEqual([a, b]);
  });

  it('deleteSelected removes every selected event in one step, and one undo brings them all back', async () => {
    const { a, b, c } = await setup();
    const before = structuredClone(store().events);
    const pastBefore = store().past.length;
    store().selectMany([a, b]);
    store().deleteSelected();
    expect(Object.keys(store().events)).toEqual([c]);
    expect([store().selectedEventId, store().selectedEventIds]).toEqual([null, []]);
    expect(store().past.length).toBe(pastBefore + 1);
    store().undo();
    expect(store().events).toEqual(before);
  });

  it('deleteSelected on a single selection deletes just that event; with nothing selected it does nothing', async () => {
    const { a, b } = await setup();
    const pastBefore = store().past.length;
    store().deleteSelected();
    expect(store().past.length).toBe(pastBefore);
    store().select(a);
    store().deleteSelected();
    expect(Object.keys(store().events)).toContain(b);
    expect(store().events[a]).toBeUndefined();
  });
});
