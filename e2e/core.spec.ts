import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Fixed clock: Monday, Nov 2, 2026. */
const NOW = new Date('2026-11-02T12:00:00-05:00');

type StoredEvent = { id: string; title: string; templateId: string; startAt: string; endAt: string; color: string };

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
}

/** Reads the files the app wrote. Waits out the save debounce first. */
async function storedEvents(page: Page): Promise<StoredEvent[]> {
  await page.waitForTimeout(250);
  return page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('juicy-calendar:file:events/'))
      .map((key) => JSON.parse(localStorage.getItem(key)!) as StoredEvent),
  );
}

async function onlyEvent(page: Page): Promise<StoredEvent> {
  const events = await storedEvents(page);
  expect(events).toHaveLength(1);
  return events[0]!;
}

const minutes = (event: StoredEvent) =>
  (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60_000;

function localTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('element has no box');
  return rect;
}

/** Client coordinates for a column and a time, with the default 08:00 start at 1 px/min. */
async function point(page: Page, column: number, hour: number, minute = 0) {
  const grid = await box(page.getByTestId('calendar-columns'));
  const count = await page.getByTestId('day-column').count();
  return {
    x: grid.x + (grid.width / count) * (column + 0.5),
    y: grid.y + (hour - 8) * 60 + minute,
  };
}

/** The magnet pulls toward a half-hour line only within this many screen pixels (engine/pointer.ts). */
const MAGNET_PX = 8;

async function dragBall(page: Page, index: number, target: { x: number; y: number }) {
  const ball = await box(page.getByTestId('template-ball').nth(index));
  await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  await page.mouse.move(target.x, target.y);
  // Release only after the drag state is committed (NFR-01). Releasing earlier makes onDragEnd see no active item.
  await expect(page.locator('.ball-dragging-source')).toHaveCount(1);
  const grid = await box(page.getByTestId('calendar-columns'));
  const inside =
    target.x >= grid.x && target.x <= grid.x + grid.width && target.y >= grid.y && target.y <= grid.y + grid.height;
  if (inside) {
    // "Preview visible" is not enough: the first preview can show a mid-path position while the final moves are
    // still uncommitted (ticket 022). Wait until it sits at the target, within the 8 px magnet pull. The mid-path
    // point is 30 px away, so it can never be mistaken for the target.
    await expect
      .poll(async () => {
        const ghost = await page.getByTestId('drop-ghost').first().boundingBox();
        return ghost ? Math.abs(ghost.y - target.y) : Infinity;
      })
      .toBeLessThanOrEqual(MAGNET_PX);
  }
  await page.mouse.up();
}

async function createAt(page: Page, column: number, hour: number, minute = 0, ballIndex = 0) {
  await dragBall(page, ballIndex, await point(page, column, hour, minute));
  // The drop animation scales the block; wait so measured boxes are its resting geometry.
  await expect(page.locator('.event-drop')).toHaveCount(0);
}

const scrollTo = (page: Page, top: number) =>
  page.getByTestId('calendar-scroller').evaluate((element, value) => {
    element.scrollTop = value;
  }, top);

async function dragFromTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => open(page));

test('[TC-01][AC-01.1,FR-01,FR-02,NFR-01] dropping a ball creates a 120-minute event at the exact position, and keeps the ball', async ({ page }) => {
  await createAt(page, 0, 10, 30);
  const event = await onlyEvent(page);
  expect(localTime(event.startAt)).toBe('Mon 10:30');
  expect(localTime(event.endAt)).toBe('Mon 12:30');
  expect(minutes(event)).toBe(120);
  expect(event).toMatchObject({ templateId: 'coding', color: '#E98B87' });
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await expect(page.getByTestId('event-time')).toHaveText('10:30–12:30');
});

test('[TC-02][AC-01.2,FR-01,NFR-01] dropping outside the calendar or pressing Escape creates nothing', async ({ page }) => {
  const before = await eventFileHashes(page);
  expect(before).toEqual({});

  await dragBall(page, 0, { x: 50, y: 700 });
  expect(await eventFileHashes(page)).toEqual(before);
  // 碎片回饋（PRD AC-01.2、測試計畫 TC-02）：放開後出現，並在動畫結束（560 ms）後消失，不會停在畫面上。
  const particles = page.locator('.split-particle');
  await expect(particles).toHaveCount(18);
  await expect
    .poll(() => particles.evaluateAll((all) => Math.max(...all.map((el) => Number(getComputedStyle(el).opacity)))), { timeout: 3000 })
    .toBe(0);

  const ball = await box(page.getByTestId('template-ball').first());
  const target = await point(page, 1, 10);
  await page.mouse.move(ball.x + 20, ball.y + 20);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await expect(page.getByTestId('drop-ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);
  expect(await eventFileHashes(page)).toEqual(before);

  // 球仍可再次拖曳
  await createAt(page, 0, 10);
  expect(await storedEvents(page)).toHaveLength(1);
});

test('balls are one flat colour with no gradient or inset effect', async ({ page }) => {
  const styles = await page.getByTestId('template-ball').evaluateAll((balls) =>
    balls.map((ball) => {
      const style = getComputedStyle(ball);
      return { image: style.backgroundImage, shadow: style.boxShadow, radius: style.borderRadius, color: style.backgroundColor };
    }),
  );
  expect(new Set(styles.map((style) => style.color)).size).toBe(6);
  for (const style of styles) {
    expect(style.image).toBe('none');
    expect(style.shadow).not.toContain('inset');
    expect(style.radius).toBe('50%');
  }
});

test('moving preserves duration, works across dates, and is not snapped', async ({ page }) => {
  await page.getByLabel('30 minute magnet').uncheck();
  await createAt(page, 0, 10);
  const from = await point(page, 0, 11);
  const to = await point(page, 2, 14, 7);
  await dragFromTo(page, from, to);
  const event = await onlyEvent(page);
  expect(localTime(event.startAt)).toBe('Wed 13:07');
  expect(minutes(event)).toBe(120);
});

test('resizing changes only the dragged endpoint, without snapping', async ({ page }) => {
  await page.getByLabel('30 minute magnet').uncheck();
  await createAt(page, 0, 10);
  const before = await onlyEvent(page);
  const block = await box(page.getByTestId('event-block'));

  await dragFromTo(
    page,
    { x: block.x + block.width / 2, y: block.y + block.height - 2 },
    { x: block.x + block.width / 2, y: block.y + block.height - 2 + 47 },
  );
  const longer = await onlyEvent(page);
  expect(longer.startAt).toBe(before.startAt);
  expect(minutes(longer)).toBe(167);

  const resized = await box(page.getByTestId('event-block'));
  await dragFromTo(
    page,
    { x: resized.x + resized.width / 2, y: resized.y + 2 },
    { x: resized.x + resized.width / 2, y: resized.y + 2 - 23 },
  );
  const earlier = await onlyEvent(page);
  expect(earlier.endAt).toBe(longer.endAt);
  expect(localTime(earlier.startAt)).toBe('Mon 09:37');
});

test('Escape cancels an active move', async ({ page }) => {
  await createAt(page, 0, 10);
  const before = await onlyEvent(page);
  const from = await point(page, 0, 11);
  const to = await point(page, 3, 15);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect(page.getByTestId('drag-chip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('drag-chip')).toHaveCount(0);
  expect(await onlyEvent(page)).toEqual(before);
});

test('double-click names one event only; Enter saves and Escape cancels', async ({ page }) => {
  await createAt(page, 0, 10);
  await createAt(page, 1, 10);
  const first = page.getByTestId('event-block').first();
  const before = await box(first);

  await first.dblclick();
  const input = page.getByTestId('event-title-input');
  await expect(input).toBeFocused();
  await input.fill('Fix Drag and Drop Bugs');
  await input.press('Enter');
  await expect(page.getByTestId('event-title')).toHaveText(['Fix Drag and Drop Bugs', 'Coding']);
  expect(await box(first)).toEqual(before);

  await first.dblclick();
  await input.fill('Discard me');
  await input.press('Escape');
  await expect(page.getByTestId('event-title').first()).toHaveText('Fix Drag and Drop Bugs');

  await first.dblclick();
  await input.fill('Saved on blur');
  await page.getByTestId('range-label').click();
  await expect(page.getByTestId('event-title').first()).toHaveText('Saved on blur');
  const templates = await page.evaluate(() => localStorage.getItem('juicy-calendar:file:templates/coding.json'));
  expect(JSON.parse(templates!).name).toBe('Coding');
});

test('overlapping events are allowed and keep their times', async ({ page }) => {
  await createAt(page, 0, 10);
  await createAt(page, 0, 11, 0, 1);
  const blocks = page.getByTestId('event-block');
  await expect(blocks).toHaveCount(2);
  const [a, b] = [await box(blocks.nth(0)), await box(blocks.nth(1))];
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
  const times = (await storedEvents(page)).map((event) => localTime(event.startAt)).sort();
  expect(times).toEqual(['Mon 10:00', 'Mon 11:00']);
});

// Ticket 022. A slow machine makes the drag state lag behind the mouse; dragBall must still release at the target.
test('[TC-01][AC-01.1,FR-01,NFR-01] a ball released after a slow drag still lands at the exact target time', async ({ page }) => {
  await page.addInitScript(() => {
    // Reproduces a loaded machine: React commits nothing until the 6th move of the drag, so the first preview shows a
    // mid-path position, and later commits are held back. Mouse input is unaffected. React schedules via MessagePort.
    let moves = 0;
    document.addEventListener('pointerdown', () => (moves = 0), true);
    document.addEventListener('pointermove', () => moves++, true);
    const post = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (this: MessagePort, ...args: Parameters<typeof post>) {
      const run = () => post.apply(this, args);
      const wait = () => {
        if (document.querySelector('[data-testid="drop-ghost"]')) setTimeout(run, 1000);
        else if (moves > 0 && moves < 6) setTimeout(wait, 1);
        else run();
      };
      wait();
    } as typeof post;
  });
  await page.reload();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await createAt(page, 0, 10);
  expect(localTime((await onlyEvent(page)).startAt)).toBe('Mon 10:00');
});

test('cross-midnight events render whole on overnight and split on 24h timelines', async ({ page }) => {
  await scrollTo(page, 500);
  await createAt(page, 0, 23);
  const event = await onlyEvent(page);
  expect(localTime(event.endAt)).toBe('Tue 01:00');
  await expect(page.getByTestId('event-block')).toHaveCount(1);

  await page.getByLabel('Timeline start').selectOption('0');
  await page.getByLabel('Timeline end').selectOption('0');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await expect(page.getByTestId('event-block').nth(0).getByTestId('resize-end')).toHaveCount(0);
  await expect(page.getByTestId('event-block').nth(1).getByTestId('resize-start')).toHaveCount(0);
});

test('events outside the visible hours are counted in the day header', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.getByLabel('Timeline start').selectOption('14');
  await page.getByLabel('Timeline end').selectOption('20');
  await expect(page.getByTestId('event-block')).toHaveCount(0);
  await expect(page.getByTestId('hidden-count')).toHaveText('+1');
});

test('weekly and daily views share data, and edits carry across', async ({ page }) => {
  await createAt(page, 1, 10);
  const weekBlock = await box(page.getByTestId('event-block'));

  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'day' }).click();
  await page.getByRole('button', { name: 'Next period' }).click();
  await expect(page.getByTestId('day-column')).toHaveCount(1);
  const dayBlock = await box(page.getByTestId('event-block'));
  expect(dayBlock.height).toBe(weekBlock.height);
  expect(dayBlock.y).toBe(weekBlock.y);

  await dragFromTo(
    page,
    { x: dayBlock.x + 50, y: dayBlock.y + 60 },
    { x: dayBlock.x + 50, y: dayBlock.y + 90 },
  );
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'week' }).click();
  await expect(page.getByTestId('day-column')).toHaveCount(7);
  await expect(page.getByTestId('event-time')).toHaveText('10:30–12:30');
});

test('zoom scales positions and pointer mapping together', async ({ page }) => {
  await page.getByLabel('Zoom').fill('2');
  await scrollTo(page, 0);
  const grid = await box(page.getByTestId('calendar-columns'));
  const x = grid.x + grid.width / 14;
  await dragBall(page, 0, { x, y: grid.y + 300 });
  await expect(page.locator('.event-drop')).toHaveCount(0);
  const event = await onlyEvent(page);
  expect(localTime(event.startAt)).toBe('Mon 10:30');
  const block = await box(page.getByTestId('event-block'));
  expect(block.height).toBe(240);
});

test('moving stays correct after scrolling the calendar', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 600 });
  await createAt(page, 0, 10);
  await scrollTo(page, 120);
  const block = await box(page.getByTestId('event-block'));
  await dragFromTo(
    page,
    { x: block.x + 30, y: block.y + 40 },
    { x: block.x + 30, y: block.y + 100 },
  );
  expect(localTime((await onlyEvent(page)).startAt)).toBe('Mon 11:00');
});

test('undo and redo cover create, move, resize, name and delete', async ({ page }) => {
  await createAt(page, 0, 10);
  const created = await onlyEvent(page);
  await dragFromTo(page, await point(page, 0, 11), await point(page, 0, 12));
  const block = await box(page.getByTestId('event-block'));
  await dragFromTo(
    page,
    { x: block.x + 30, y: block.y + block.height - 2 },
    { x: block.x + 30, y: block.y + block.height + 28 },
  );
  await page.getByTestId('event-block').dblclick();
  await page.getByTestId('event-title-input').fill('Named');
  await page.getByTestId('event-title-input').press('Enter');
  const final = await onlyEvent(page);
  expect(final.title).toBe('Named');

  await page.keyboard.press('Delete');
  expect(await storedEvents(page)).toHaveLength(0);

  await page.keyboard.press('Control+z');
  expect((await onlyEvent(page)).title).toBe('Named');
  await page.keyboard.press('Control+z');
  expect((await onlyEvent(page)).title).toBe('Coding');
  await page.keyboard.press('Control+z');
  expect(minutes(await onlyEvent(page))).toBe(120);
  await page.keyboard.press('Control+z');
  expect(await onlyEvent(page)).toEqual(created);
  await page.keyboard.press('Control+z');
  expect(await storedEvents(page)).toHaveLength(0);

  for (let step = 0; step < 4; step += 1) await page.keyboard.press('Control+Shift+z');
  expect(await onlyEvent(page)).toEqual(final);
  await page.keyboard.press('Meta+Shift+z');
  expect(await storedEvents(page)).toHaveLength(0);
});

test('one drag is exactly one undo step', async ({ page }) => {
  await createAt(page, 0, 10);
  const created = await onlyEvent(page);
  await dragFromTo(page, await point(page, 0, 11), await point(page, 3, 15));
  await page.keyboard.press('Control+z');
  expect(await onlyEvent(page)).toEqual(created);
});

test('inspector shows and edits the selected event, and collapses', async ({ page }) => {
  await createAt(page, 0, 10, 30);
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await page.getByTestId('event-block').click();
  await expect(page.getByTestId('inspector-template')).toHaveText('Coding');
  await expect(page.getByTestId('inspector-date')).toHaveValue('2026-11-02');
  await expect(page.getByTestId('inspector-start')).toHaveValue('10:30');
  await expect(page.getByTestId('inspector-end')).toHaveValue('12:30');
  await expect(page.getByTestId('inspector-duration')).toHaveValue('120');

  await page.getByTestId('inspector-duration').fill('45');
  await page.getByTestId('inspector-duration').press('Enter');
  await expect(page.getByTestId('event-time')).toHaveText('10:30–11:15');
  await page.getByTestId('inspector-title').fill('Research');
  await page.getByTestId('inspector-title').press('Enter');
  await expect(page.getByTestId('event-title')).toHaveText('Research');

  await page.getByTestId('inspector-collapse').click();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await page.getByTestId('inspector-expand').click();
  await expect(page.getByTestId('inspector')).toBeVisible();

  await page.getByTestId('inspector-delete').click();
  expect(await storedEvents(page)).toHaveLength(0);
  await expect(page.getByTestId('inspector')).toHaveCount(0);
});

test('a press on another event saves a pending inspector edit to the right event', async ({ page }) => {
  await createAt(page, 0, 10);
  await createAt(page, 1, 10);
  await page.getByTestId('event-block').nth(1).click();
  await page.getByTestId('inspector-title').fill('Pending');
  await page.getByTestId('event-block').first().click({ position: { x: 20, y: 40 } });
  await expect
    .poll(async () => (await storedEvents(page)).map((event) => event.title).sort())
    .toEqual(['Coding', 'Pending']);
});

test('Delete inside a text field does not delete the event', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.getByTestId('event-block').click();
  await page.getByTestId('inspector-title').focus();
  await page.keyboard.press('Backspace');
  expect(await storedEvents(page)).toHaveLength(1);
});

test('templates can be added, edited and deleted without changing events', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.getByTestId('add-template').click();
  await page.getByLabel('Template name').fill('Music');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(7);

  await page.getByTestId('template-name').first().click();
  await page.getByLabel('Template name').fill('Hacking');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('template-name').first()).toHaveText('Hacking');
  await expect(page.getByTestId('event-title')).toHaveText('Coding');

  await page.getByTestId('template-name').first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  await page.getByTestId('event-block').click();
  await expect(page.getByTestId('inspector-template')).toHaveText('Deleted template');
});

test('week navigation and data survive a reload', async ({ page }) => {
  await createAt(page, 0, 10, 30);
  await page.getByTestId('event-block').dblclick();
  await page.getByTestId('event-title-input').fill('Survives');
  await page.getByTestId('event-title-input').press('Enter');
  await page.getByLabel('Timeline start').selectOption('9');
  await page.waitForTimeout(250);

  await page.reload();
  await expect(page.getByTestId('event-title')).toHaveText('Survives');
  await expect(page.getByTestId('event-time')).toHaveText('10:30–12:30');
  await expect(page.getByLabel('Timeline start')).toHaveValue('9');

  await page.getByRole('button', { name: 'Next period' }).click();
  await expect(page.getByTestId('range-label')).toHaveText('Nov 9 – 15, 2026');
  await expect(page.getByTestId('event-block')).toHaveCount(0);
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
});

test('a malformed event file is reported, skipped and left in place', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.waitForTimeout(250);
  await page.evaluate(() => localStorage.setItem('juicy-calendar:file:events/broken.json', '{oops'));
  await page.reload();
  await expect(page.getByText('Skipped events/broken.json')).toBeVisible();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('juicy-calendar:file:events/broken.json'))).toBe('{oops');
});

test('a damaged workspace.json refuses to open', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('juicy-calendar:file:workspace.json', 'nope'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('damaged');
  expect(await page.evaluate(() => localStorage.getItem('juicy-calendar:file:workspace.json'))).toBe('nope');
});

test('the drop animation plays once and does not replay on a view change', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'day' }).click();
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'week' }).click();
  await expect(page.locator('.event-drop')).toHaveCount(0);
});

test('controls respond right after a ball drop that was rejected', async ({ page }) => {
  await dragBall(page, 0, { x: 50, y: 700 });
  await page.waitForTimeout(100);
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'day' }).click();
  await expect(page.getByTestId('day-column')).toHaveCount(1);
});


test('long press picks up a radial ball and drops in one held gesture', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.waitForTimeout(250);
  const boxes = await page.locator('.radial-choice .ball').evaluateAll((balls) =>
    balls.map((ball) => { const r = ball.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }),
  );
  const ring = { x: boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length, y: boxes.reduce((sum, b) => sum + b.y, 0) / boxes.length };
  // AC-01.4 / FR-04: hovering only wobbles the ball; the other balls stay and nothing is picked yet.
  await page.mouse.move(boxes[0]!.x, boxes[0]!.y);
  await expect(page.locator('.radial-hovered')).toHaveCount(1);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
  // Leaving the ball's circle outward picks it and the other balls vanish.
  const away = Math.hypot(boxes[0]!.x - ring.x, boxes[0]!.y - ring.y);
  await page.mouse.move(boxes[0]!.x + (boxes[0]!.x - ring.x) / away * 70, boxes[0]!.y + (boxes[0]!.y - ring.y) / away * 70, { steps: 6 });
  await expect(page.getByTestId('ball-overlay')).toBeVisible();
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  const target = await point(page, 0, 10);
  await page.mouse.move(target.x, target.y, { steps: 8 });
  expect(await storedEvents(page)).toHaveLength(0);
  await page.mouse.up();
  expect((await onlyEvent(page)).templateId).toBe('coding');
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
});

test('[TC-16][AC-01.4,FR-04] releasing the mouse while still on a hovered radial ball picks nothing', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.waitForTimeout(250);
  const first = await page.locator('.radial-choice .ball').first().evaluate((ball) => { const r = ball.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(first.x, first.y);
  await expect(page.locator('.radial-hovered')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
  expect(await storedEvents(page)).toHaveLength(0);
});

test('[TC-16][AC-01.4,FR-04] returning from a hovered ball to the ring centre cancels without picking', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.waitForTimeout(250);
  const boxes = await page.locator('.radial-choice .ball').evaluateAll((balls) =>
    balls.map((ball) => { const r = ball.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }),
  );
  const ring = { x: boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length, y: boxes.reduce((sum, b) => sum + b.y, 0) / boxes.length };
  await page.mouse.move(boxes[0]!.x, boxes[0]!.y);
  await expect(page.locator('.radial-hovered')).toHaveCount(1);
  await page.mouse.move(ring.x, ring.y, { steps: 6 });
  await expect(page.locator('.radial-hovered')).toHaveCount(0);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
  await page.mouse.up();
  expect(await storedEvents(page)).toHaveLength(0);
});

test('[TC-02][AC-01.2,FR-01] a radial-picked ball dropped outside the calendar splits into small balls, and not when motion is reduced', async ({ page }) => {
  const pickRadialAndDropOutside = async () => {
    await page.mouse.move(650, 450);
    await page.mouse.down();
    await expect(page.locator('.radial-choice')).toHaveCount(6);
    await page.waitForTimeout(250);
    const first = await page.locator('.radial-choice .ball').first().evaluate((ball) => { const r = ball.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(first.x, first.y);
    await page.mouse.move(first.x, first.y - 80, { steps: 6 });
    await expect(page.getByTestId('ball-overlay')).toBeVisible();
    await page.mouse.move(50, 700, { steps: 8 });
    await page.mouse.up();
  };
  await pickRadialAndDropOutside();
  await expect(page.locator('.split-particle')).toHaveCount(18);
  await expect(page.locator('.split-particle').first()).toBeVisible();
  expect(await storedEvents(page)).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(700);
  await pickRadialAndDropOutside();
  await expect(page.locator('.split-particle').first()).toBeHidden();
});

test('invalid drops split into small balls and can be retried', async ({ page }) => {
  await dragBall(page, 0, { x: 50, y: 700 });
  await expect(page.locator('.split-particle')).toHaveCount(18);
  expect(await storedEvents(page)).toHaveLength(0);
  await createAt(page, 0, 10);
  expect(minutes(await onlyEvent(page))).toBe(120);
});

test('magnet attracts near half-hours and its disabled setting survives reload', async ({ page }) => {
  await createAt(page, 0, 10, 26);
  expect(localTime((await onlyEvent(page)).startAt)).toBe('Mon 10:30');
  await page.keyboard.press('Control+z');
  await page.getByLabel('30 minute magnet').uncheck();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByLabel('30 minute magnet')).not.toBeChecked();
  await createAt(page, 0, 10, 26);
  expect(localTime((await onlyEvent(page)).startAt)).toBe('Mon 10:26');
});

test('leaving the window cancels a ball drag with split feedback', async ({ page }) => {
  const ball = await box(page.getByTestId('template-ball').first());
  await page.mouse.move(ball.x + 22, ball.y + 22);
  await page.mouse.down();
  await page.mouse.move(500, 400, { steps: 5 });
  await expect(page.getByTestId('ball-overlay')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
  await expect(page.locator('.split-particle')).toHaveCount(18);
  await page.mouse.up();
  expect(await storedEvents(page)).toHaveLength(0);
  await createAt(page, 0, 10);
  expect(minutes(await onlyEvent(page))).toBe(120);
});

test('past dates mute event colours as the local day changes without altering saved colours', async ({ page }) => {
  await page.clock.install();
  await createAt(page, 0, 10);
  const saved = await onlyEvent(page);
  const block = page.getByTestId('event-block');
  const original = await block.evaluate(element => getComputedStyle(element).backgroundColor);
  await page.clock.setFixedTime(new Date('2026-11-03T00:01:00-05:00'));
  await page.clock.fastForward(60_000);
  await expect.poll(() => block.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(original);
  expect((await onlyEvent(page)).color).toBe(saved.color);
  await createAt(page, 1, 10);
  const today = page.getByTestId('day-column').nth(1).getByTestId('event-block');
  await expect(today).toHaveCSS('background-color', original);
});

/** 事件檔清單與每檔的 SHA-256（TC-03、TC-02 的「資料沒變」判定）。 */
async function eventFileHashes(page: Page): Promise<Record<string, string>> {
  await page.waitForTimeout(250);
  const files = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith('juicy-calendar:file:events/'))
        .map((key) => [key, localStorage.getItem(key)!]),
    ),
  );
  return Object.fromEntries(Object.entries(files).map(([key, text]) => [key, createHash('sha256').update(text).digest('hex')]));
}

test('[TC-03][AC-01.3,FR-02,R-3] 雙擊命名：清空或超過 30 字按 Enter 被拒絕，畫面與事件檔都不變', async ({ page }) => {
  await createAt(page, 0, 10, 30);
  await page.getByTestId('event-block').dblclick();
  await page.getByTestId('event-title-input').fill('寫 PRD');
  await page.getByTestId('event-title-input').press('Enter');
  await expect(page.getByTestId('event-title')).toHaveText('寫 PRD');
  const before = await eventFileHashes(page);
  expect(Object.keys(before)).toHaveLength(1);

  for (const bad of ['', '   ', '字'.repeat(31)]) {
    await page.getByTestId('event-block').dblclick();
    await page.getByTestId('event-title-input').fill(bad);
    await page.getByTestId('event-title-input').press('Enter');
    await expect(page.getByTestId('event-title')).toHaveText('寫 PRD');
    expect(await eventFileHashes(page)).toEqual(before);
  }

  await page.getByTestId('event-block').dblclick();
  await page.getByTestId('event-title-input').fill('字'.repeat(30));
  await page.getByTestId('event-title-input').press('Enter');
  await expect(page.getByTestId('event-title')).toHaveText('字'.repeat(30));
});

test('[TC-03][AC-01.3,FR-02,R-3] 右側面板的名稱：同一條規則，被拒絕時欄位還原', async ({ page }) => {
  await createAt(page, 0, 10);
  await page.getByTestId('event-block').click();
  const before = await eventFileHashes(page);
  const input = page.getByTestId('inspector-title');

  for (const bad of ['', '字'.repeat(31)]) {
    await input.fill(bad);
    await input.press('Enter');
    await expect(input).toHaveValue('Coding');
    await expect(page.getByTestId('event-title')).toHaveText('Coding');
    expect(await eventFileHashes(page)).toEqual(before);
  }

  await input.fill('  寫 PRD  ');
  await input.press('Enter');
  await expect(input).toHaveValue('寫 PRD');
  await expect(page.getByTestId('event-title')).toHaveText('寫 PRD');
});

test('[TC-04][FR-03,Q-04,R-3] 右側面板的結束時間與持續分鐘：不合法的輸入被拒絕，欄位還原，事件檔不變', async ({ page }) => {
  await createAt(page, 0, 10); // 10:00–12:00
  await page.getByTestId('event-block').click();
  const before = await eventFileHashes(page);

  const end = page.getByTestId('inspector-end');
  for (const bad of ['09:00', '10:00']) {
    await end.fill(bad);
    await end.press('Enter');
    await expect(end).toHaveValue('12:00');
    await expect(page.getByTestId('event-time')).toHaveText('10:00–12:00');
    expect(await eventFileHashes(page)).toEqual(before);
  }

  const duration = page.getByTestId('inspector-duration');
  for (const bad of ['0', '10081', '1e12']) {
    await duration.fill(bad);
    await duration.press('Enter');
    await expect(duration).toHaveValue('120');
    expect(await eventFileHashes(page)).toEqual(before);
  }

  await end.fill('11:00');
  await end.press('Enter');
  await expect(duration).toHaveValue('60');
  await expect(page.getByTestId('event-time')).toHaveText('10:00–11:00');
});

test('[TC-03][U-11,FR-02] 模板編輯器的名稱：31 字不能儲存，30 字可以', async ({ page }) => {
  await page.getByTestId('add-template').click();
  const save = page.getByRole('button', { name: 'Save' });
  await page.getByLabel('Template name').fill('字'.repeat(31));
  await expect(save).toBeDisabled();
  await page.getByLabel('Template name').fill('   ');
  await expect(save).toBeDisabled();
  await page.getByLabel('Template name').fill('字'.repeat(30));
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByTestId('template-ball')).toHaveCount(7);
});

async function createMondayEvent(page: Page) {
  await createAt(page, 0, 10, 30);
  const event = await onlyEvent(page);
  expect(event).toMatchObject({ startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z' });
  return event;
}

test('[TC-05][FR-02,U-04] dragging the bottom edge far away stops at 10080 elapsed minutes', async ({ page }) => {
  const before = await createMondayEvent(page);
  const block = await box(page.getByTestId('event-block'));
  const x = block.x + block.width / 2;
  await dragFromTo(page, { x, y: block.y + block.height - 2 }, { x, y: block.y + block.height - 2 + 14_000 });
  const longest = await onlyEvent(page);
  expect(longest.startAt).toBe(before.startAt);
  expect(longest.endAt).toBe('2026-11-09T15:30:00.000Z');
  expect(minutes(longest)).toBe(10_080);
});

test('[TC-05][FR-02,U-04] dragging the top edge far away stops at 10080 elapsed minutes', async ({ page }) => {
  await createMondayEvent(page);
  const block = await box(page.getByTestId('event-block'));
  const x = block.x + block.width / 2;
  await dragFromTo(page, { x, y: block.y + 2 }, { x, y: block.y + 2 - 14_000 });
  const earliest = await onlyEvent(page);
  expect(earliest.endAt).toBe('2026-11-02T17:30:00.000Z');
  expect(earliest.startAt).toBe('2026-10-26T17:30:00.000Z');
  expect(minutes(earliest)).toBe(10_080);
});
