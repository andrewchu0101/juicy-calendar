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

async function dragBall(page: Page, index: number, target: { x: number; y: number }) {
  const ball = await box(page.getByTestId('template-ball').nth(index));
  await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  await page.mouse.move(target.x, target.y, { steps: 3 });
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

test('dropping a ball creates a 120-minute event at the exact position, and keeps the ball', async ({ page }) => {
  await createAt(page, 0, 10, 30);
  const event = await onlyEvent(page);
  expect(localTime(event.startAt)).toBe('Mon 10:30');
  expect(localTime(event.endAt)).toBe('Mon 12:30');
  expect(minutes(event)).toBe(120);
  expect(event).toMatchObject({ templateId: 'coding', color: '#E98B87' });
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await expect(page.getByTestId('event-time')).toHaveText('10:30–12:30');
});

test('dropping outside the calendar or pressing Escape creates nothing', async ({ page }) => {
  await dragBall(page, 0, { x: 50, y: 700 });
  expect(await storedEvents(page)).toHaveLength(0);

  const ball = await box(page.getByTestId('template-ball').first());
  const target = await point(page, 1, 10);
  await page.mouse.move(ball.x + 20, ball.y + 20);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await expect(page.getByTestId('drop-ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);
  expect(await storedEvents(page)).toHaveLength(0);
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
  const choice = await box(page.locator('.radial-choice .ball').first());
  await page.mouse.move(choice.x + 22, choice.y + 22);
  await expect(page.getByTestId('ball-overlay')).toBeVisible();
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  const target = await point(page, 0, 10);
  await page.mouse.move(target.x, target.y, { steps: 8 });
  expect(await storedEvents(page)).toHaveLength(0);
  await page.mouse.up();
  expect((await onlyEvent(page)).templateId).toBe('coding');
  await expect(page.getByTestId('ball-overlay')).toHaveCount(0);
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
