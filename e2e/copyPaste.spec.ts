import { expect, test, type Page } from '@playwright/test';

const SOURCE = {
  id: 'copy-source', templateId: 'coding', title: 'Source', color: '#E98B87',
  startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T18:00:00.000Z',
};
const EVENT_KEY = `juicy-calendar:file:events/${SOURCE.id}.json`;

async function openSource(page: Page, extra: typeof SOURCE[] = []) {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(events => {
    for (const event of events) localStorage.setItem(`juicy-calendar:file:events/${event.id}.json`, JSON.stringify(event));
  }, [SOURCE, ...extra]);
  await page.reload();
  await page.locator('[data-event-id="copy-source"]').click();
  await expect(page.locator('[data-event-id="copy-source"]')).toHaveAttribute('data-selected', 'true');
}

async function timePoint(page: Page, column = 2, minutes = 180) {
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  return { x: box.x + box.width * (column + 0.5) / 7, y: box.y + minutes };
}

async function eventDisk(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('juicy-calendar:file:events/'))
    .sort().map(key => [key, localStorage.getItem(key)])));
}

test('[TC-19][R-12,FR-16] an open radial gesture rejects paste without changing event files', async ({ page }) => {
  await openSource(page);
  await page.keyboard.press('Control+c');
  const before = await eventDisk(page);
  const point = await timePoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(250);
  expect.soft(await page.getByTestId('event-block').count()).toBe(1);
  expect.soft(await eventDisk(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

for (const invalid of ['outside', 'timeline', 'sticky-header'] as const) {
  test(`[TC-19][AC-05.3,FR-16] rejects ${invalid} after visiting a valid target, with no files or selection changed`, async ({ page }) => {
    await openSource(page);
    await page.keyboard.press('Control+c');
    const before = await eventDisk(page);
    const valid = await timePoint(page);
    await page.mouse.move(valid.x, valid.y);
    if (invalid === 'sticky-header') {
      await page.getByTestId('calendar-scroller').evaluate(element => { element.scrollTop = 120; });
      await page.getByTestId('day-header').nth(2).hover();
    } else if (invalid === 'outside') await page.getByTestId('range-label').hover();
    else {
      const box = await page.getByTestId('calendar-scroller').boundingBox();
      if (!box) throw new Error('scroller has no box');
      await page.mouse.move(box.x + 20, box.y + 100);
    }
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(250);
    expect(await page.getByTestId('event-block').count()).toBe(1);
    await expect(page.locator('[data-event-id="copy-source"]')).toHaveAttribute('data-selected', 'true');
    expect(await eventDisk(page)).toEqual(before);
    // A rejected paste must not add a hidden history entry.
    await page.keyboard.press('Control+z');
    expect(await eventDisk(page)).toEqual(before);
  });
}

test('[TC-19][AC-05.1,FR-15] keyboard multi-paste, one undo/redo and restart preserve both events', async ({ page }) => {
  await openSource(page, [{ ...SOURCE, id: 'second', title: 'Second',
    startAt: '2026-11-03T19:00:00.000Z', endAt: '2026-11-03T20:00:00.000Z' }]);
  const from = await timePoint(page, 2, 500);
  const to = await timePoint(page, 0, 120);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-selected="true"]')).toHaveCount(2);
  await page.keyboard.press('Control+c');
  const target = await timePoint(page);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  await expect(page.getByTestId('event-block')).toHaveCount(4);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(2);
  await expect.poll(async () => Object.keys(await eventDisk(page)).length).toBe(4);
  const pasted = await eventDisk(page);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await expect.poll(async () => Object.keys(await eventDisk(page)).length).toBe(2);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('event-block')).toHaveCount(4);
  await expect.poll(() => eventDisk(page)).toEqual(pasted);
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(4);
  const again = await timePoint(page);
  await page.mouse.move(again.x, again.y);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(250);
  expect(await eventDisk(page)).toEqual(pasted); // Restart clears the App clipboard.
});

for (const magnet of [true, false]) {
  test(`[TC-19][FR-15,R-1] pointer paste respects magnet=${magnet}`, async ({ page }) => {
    await openSource(page);
    await page.getByLabel('30 minute magnet').setChecked(magnet);
    await page.keyboard.press('Control+c');
    const target = await timePoint(page, 2, 184); // 11:04 lies four pixels from 11:00.
    await page.mouse.move(target.x, target.y);
    await page.keyboard.press('Control+v');
    await expect(page.getByTestId('event-block')).toHaveCount(2);
    await expect.poll(async () => {
      const disk = await eventDisk(page);
      const entry = Object.entries(disk).find(([key]) => key !== EVENT_KEY);
      return entry ? JSON.parse(entry[1]!).startAt : null;
    }).toBe(magnet ? '2026-11-04T16:00:00.000Z' : '2026-11-04T16:04:00.000Z');
  });
}

test('[TC-19][AC-05.3,FR-16] text field copy and paste remain native and do not create calendar events', async ({ page }) => {
  await openSource(page);
  const before = await eventDisk(page);
  const prevented = await page.getByTestId('inspector-title').evaluate(input => {
    return ['c', 'v'].map(key => {
      const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  expect(prevented).toEqual([false, false]);
  expect(await eventDisk(page)).toEqual(before);
});

test('[TC-19][AC-05.2,FR-16] closing and reopening a workspace clears copied events', async ({ page }) => {
  await openSource(page);
  await page.keyboard.press('Control+c');
  const before = await eventDisk(page);
  await page.getByRole('button', { name: 'Switch', exact: true }).click();
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  const target = await timePoint(page);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(250);
  expect(await eventDisk(page)).toEqual(before);
});

test('[TC-19][AC-05.3,FR-16] an empty clipboard rejects paste and a template drag cannot paste an existing snapshot', async ({ page }) => {
  await openSource(page);
  const before = await eventDisk(page);
  const target = await timePoint(page);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(250);
  expect(await eventDisk(page)).toEqual(before);
  await page.keyboard.press('Control+c');
  const ball = await page.getByTestId('template-ball').first().boundingBox();
  if (!ball) throw new Error('template has no box');
  await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  await page.mouse.move(target.x, target.y);
  await expect(page.getByTestId('drop-ghost')).toHaveCount(1);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(250);
  expect(await eventDisk(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);
});

test('[TC-19][AC-05.1,FR-15] Ctrl+C and Ctrl+V create a selected 150-minute copy at the pointer without changing the source', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(({ key, source }) => {
    localStorage.setItem(key, JSON.stringify(source));
  }, { key: EVENT_KEY, source: SOURCE });
  await page.reload();
  const source = page.locator('[data-event-id="copy-source"]');
  await expect(source).toHaveCount(1);
  await source.click();
  await expect(source).toHaveAttribute('data-selected', 'true');
  const sourceBytes = await page.evaluate(key => localStorage.getItem(key), EVENT_KEY);
  await page.keyboard.press('Control+c');
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar columns have no box');
  // Wednesday 11:00 EST: column 2, default 08:00 start, 1 pixel per minute.
  await page.mouse.move(columns.x + columns.width * 2.5 / 7, columns.y + 180);
  await page.keyboard.press('Control+v');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  const copy = page.locator('[data-event-id]:not([data-event-id="copy-source"])');
  await expect(copy).toHaveAttribute('data-selected', 'true');
  const copyId = await copy.getAttribute('data-event-id');
  expect(copyId).not.toBe(SOURCE.id);
  const copyKey = `juicy-calendar:file:events/${copyId}.json`;
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), copyKey))
    .toEqual({
      ...SOURCE, id: copyId,
      startAt: '2026-11-04T16:00:00.000Z', endAt: '2026-11-04T18:30:00.000Z',
    });
  expect(await page.evaluate(key => localStorage.getItem(key), EVENT_KEY)).toBe(sourceBytes);
});

test('[TC-19][R-12,030a] Delete during an event drag is rejected without changing events, selection or files', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  // Seed a valid event through the existing browser backend, avoiding the unrelated dragBall fixture race.
  await page.evaluate(({ key, source }) => {
    localStorage.setItem(key, JSON.stringify(source));
  }, { key: EVENT_KEY, source: SOURCE });
  await page.reload();
  const source = page.locator('[data-event-id="copy-source"]');
  await expect(source).toHaveCount(1);
  await source.click();
  await expect(source).toHaveAttribute('data-selected', 'true');
  const before = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).filter(key => key.startsWith('juicy-calendar:file:')).sort()
      .map(key => [key, localStorage.getItem(key)]),
  ));
  // Observe writes as well as final bytes: a delete followed by recovery would still be a side effect.
  await page.evaluate(() => {
    const writes: string[] = [];
    Object.assign(window, { copyPasteWrites: writes });
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('juicy-calendar:file:')) writes.push(`setItem:${key}`);
      return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key: string) {
      if (key.startsWith('juicy-calendar:file:')) writes.push(`removeItem:${key}`);
      return removeItem.call(this, key);
    };
  });
  const rect = await source.boundingBox();
  if (!rect) throw new Error('source event has no box');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 25);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 55, { steps: 3 });
  await expect(page.locator('body')).toHaveClass(/is-interacting-move/);
  await expect(source).toHaveAttribute('data-active', 'true');

  await page.keyboard.press('Delete');
  // Wait beyond the persistence debounce before checking both data and the write observer.
  await page.waitForTimeout(400);
  expect.soft(await source.count()).toBe(1);
  expect.soft(await page.locator('[data-event-id="copy-source"][data-selected="true"]').count()).toBe(1);
  const after = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).filter(key => key.startsWith('juicy-calendar:file:')).sort()
      .map(key => [key, localStorage.getItem(key)]),
  ));
  expect.soft(after).toEqual(before);
  expect.soft(await page.evaluate(() => Reflect.get(window, 'copyPasteWrites'))).toEqual([]);
  // Cancel the gesture; do not release and commit its preview.
  await page.keyboard.press('Escape');
  await page.mouse.up();
});
