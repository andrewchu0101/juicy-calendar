import { beforeEach, describe, expect, it } from 'vitest';
import { durationMinutes } from '../features/calendar/engine';
import { DEFAULT_SETTINGS } from '../services/persistence/schemas';
import { useAppStore } from './appStore';

const store = () => useAppStore.getState();
const coding = { id: 'coding', name: 'Coding', color: '#E98B87', defaultDuration: 30, order: 0 };

beforeEach(() => {
  store().hydrate(
    {
      meta: { schemaVersion: 1, name: 'Test', createdAt: new Date().toISOString() },
      templates: { coding },
      events: {},
      settings: DEFAULT_SETTINGS,
      issues: [],
    },
    '/tmp/test',
  );
});

describe('events', () => {
  it('creates 120-minute events regardless of the template default, keeping the template', () => {
    const id = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 10, 30))!;
    const event = store().events[id]!;
    expect(durationMinutes(event)).toBe(120);
    expect(event).toMatchObject({ templateId: 'coding', color: coding.color });
    expect(store().templates.coding).toEqual(coding);
  });

  it('keeps titles independent between events from one template', () => {
    const a = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 8))!;
    const b = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 8))!;
    store().updateEvent(a, { title: 'Fix drag bugs' });
    expect(store().events[b]?.title).toBe('Coding');
    expect(store().templates.coding?.name).toBe('Coding');
  });

  it('keeps existing events when a template is deleted', () => {
    const id = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 8))!;
    store().deleteTemplate('coding');
    expect(store().events[id]?.color).toBe(coding.color);
  });
});

describe('history', () => {
  it('undoes and redoes create, update and delete', () => {
    const id = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 8))!;
    store().updateEvent(id, { title: 'Named' });
    store().deleteEvent(id);
    expect(store().events[id]).toBeUndefined();

    store().undo();
    expect(store().events[id]?.title).toBe('Named');
    store().undo();
    expect(store().events[id]?.title).toBe('Coding');
    store().undo();
    expect(store().events[id]).toBeUndefined();
    expect(store().selectedEventId).toBeNull();

    store().redo();
    store().redo();
    expect(store().events[id]?.title).toBe('Named');
    store().redo();
    expect(store().events[id]).toBeUndefined();
  });

  it('clears redo after a new change and ignores no-op updates', () => {
    const id = store().createEventFromTemplate('coding', new Date(2026, 10, 2, 8))!;
    store().updateEvent(id, { title: 'Coding' });
    expect(store().past).toHaveLength(1);
    store().undo();
    store().createEventFromTemplate('coding', new Date(2026, 10, 3, 8));
    expect(store().future).toHaveLength(0);
  });
});

describe('templates', () => {
  it('gives new templates safe unique ids and appends them', () => {
    store().saveTemplate({ name: 'Deep Work!', color: '#83B9D0', defaultDuration: 60 });
    store().saveTemplate({ name: 'Deep Work!', color: '#83B9D0', defaultDuration: 60 });
    store().saveTemplate({ name: '../../etc', color: '#83B9D0', defaultDuration: 60 });
    store().saveTemplate({ name: '瑜珈', color: '#83B9D0', defaultDuration: 60 });
    const ids = Object.keys(store().templates);
    expect(ids).toContain('deep-work');
    expect(ids).toHaveLength(5);
    expect(ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id))).toBe(true);
    expect(store().templates['deep-work']?.order).toBe(1);
  });
});
