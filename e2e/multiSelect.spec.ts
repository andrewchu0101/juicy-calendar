import { expect, test, type Locator, type Page } from '@playwright/test';
import { RADIAL_LONG_PRESS_MS } from '../src/features/calendar/engine/limits';

/** Fixed clock: Monday, Nov 2, 2026. */
const NOW = new Date('2026-11-02T12:00:00-05:00');

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('element has no box');
  return rect;
}

/** Client coordinates for a column and a time, with the default 08:00 start at 1 px/min. */
async function point(page: Page, column: number, hour: number, minute = 0) {
  const grid = await box(page.getByTestId('calendar-columns'));
  const count = await page.getByTestId('day-column').count();
  return { x: grid.x + (grid.width / count) * (column + 0.5), y: grid.y + (hour - 8) * 60 + minute };
}

async function dragBall(page: Page, index: number, target: { x: number; y: number }) {
  const ball = await box(page.getByTestId('template-ball').nth(index));
  await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  await page.mouse.move(target.x, target.y);
  await expect(page.locator('.ball-dragging-source')).toHaveCount(1);
  await expect.poll(async () => {
    const ghost = await page.getByTestId('drop-ghost').first().boundingBox();
    return ghost ? Math.abs(ghost.y - target.y) : Infinity;
  }).toBeLessThanOrEqual(8);
  await page.mouse.up();
}

async function createAt(page: Page, column: number, hour: number) {
  const before = await page.getByTestId('event-block').count();
  await dragBall(page, 0, await point(page, column, hour));
  await expect(page.getByTestId('event-block')).toHaveCount(before + 1);
  await expect(page.locator('.event-drop')).toHaveCount(0);
}

/** The fake clock freezes timers, not React's scheduler. A few round trips let a pending render land. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      });
    }
  });
}

const selected = (page: Page) => page.locator('[data-testid="event-block"][data-selected="true"]');
const eventFiles = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('juicy-calendar:file:events/')).sort());

/** Three events: A Monday 10:00, B Tuesday 10:00, C Monday 16:00. Then freezes the clock so the long press is test-driven. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await createAt(page, 0, 10);
  await createAt(page, 1, 10);
  await createAt(page, 0, 16);
  await page.waitForTimeout(300); // the save debounce settles before time is frozen
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
});

async function marquee(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  if (release) await page.mouse.up();
}

test('[TC-18][AC-04.1,FR-12] a quick drag on empty space selects the blocks it touches, not the others, and opens no radial menu', async ({ page }) => {
  const filesBefore = await eventFiles(page);
  // From empty space (Wednesday 14:00) up-left over A (Mon 10:00) and B (Tue 10:00), clear of C (Mon 16:00).
  await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  await settle(page);
  await expect(selected(page)).toHaveCount(2);
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await page.clock.runFor(RADIAL_LONG_PRESS_MS * 2);
  expect(await eventFiles(page)).toEqual(filesBefore);
});

test('[TC-18][AC-04.1,FR-12] a marquee over empty space clears the selection', async ({ page }) => {
  await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  await expect(selected(page)).toHaveCount(2);
  await marquee(page, await point(page, 3, 9), await point(page, 4, 12));
  await settle(page);
  await expect(selected(page)).toHaveCount(0);
});

test('[TC-18][AC-04.1,FR-12] Escape during a marquee puts the earlier selection back', async ({ page }) => {
  await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  await expect(selected(page)).toHaveCount(2);
  // A new marquee over C only; Escape before release must leave A and B selected.
  await marquee(page, await point(page, 3, 18), await point(page, 0, 16, 30), false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settle(page);
  await expect(selected(page)).toHaveCount(2);
});

test('[TC-18][AC-04.1,FR-12] holding still for the long-press time opens the radial menu, and moving afterwards does not start a marquee', async ({ page }) => {
  const start = await point(page, 2, 14);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.clock.runFor(RADIAL_LONG_PRESS_MS);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.mouse.move(start.x - 200, start.y - 200, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  await expect(selected(page)).toHaveCount(0);
});

test('[TC-18][AC-04.1,FR-12] a click on one selected block shrinks the selection to that block', async ({ page }) => {
  await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  await expect(selected(page)).toHaveCount(2);
  const target = await point(page, 1, 11);
  await page.mouse.click(target.x, target.y);
  await settle(page);
  await expect(selected(page)).toHaveCount(1);
});

type Stored = { id: string; title: string; startAt: string; endAt: string };

/** Advances the frozen clock past the save debounce, then reads the event files the app wrote. */
async function stored(page: Page): Promise<Stored[]> {
  await page.clock.runFor(1000);
  await settle(page);
  const events = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('juicy-calendar:file:events/'))
      .map((key) => JSON.parse(localStorage.getItem(key)!) as Stored),
  );
  return events.sort((x, y) => x.startAt.localeCompare(y.startAt));
}

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

async function selectAAndB(page: Page) {
  await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  await expect(selected(page)).toHaveCount(2);
}

async function dragBlock(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  if (release) await page.mouse.up();
}

test('[TC-18][AC-04.2,FR-13] dragging one selected block moves all of them by the same time difference, across days, in one undo step', async ({ page }) => {
  const before = await stored(page); // A Mon 10:00, B Tue 10:00, C Mon 16:00 → sorted A, C... by start: A, C, B? use ids by title order below
  await selectAAndB(page);
  // Grab A (Mon 10:30) and drop it on Tue 12:30: +1 day and +2 hours for both.
  await dragBlock(page, await point(page, 0, 10, 30), await point(page, 1, 12, 30));
  await settle(page);
  const after = await stored(page);
  const shift = (id: string) => {
    const was = before.find((event) => event.id === id)!;
    const now = after.find((event) => event.id === id)!;
    return { delta: minutesBetween(was.startAt, now.startAt), length: minutesBetween(now.startAt, now.endAt), wasLength: minutesBetween(was.startAt, was.endAt) };
  };
  const [a, b] = [before.find((event) => new Date(event.startAt).getUTCDay() === 1 && minutesBetween(event.startAt, event.endAt) === 120 && event.startAt.includes('T15:00'))!, before.find((event) => event.startAt.startsWith('2026-11-03'))!];
  expect(shift(a.id).delta).toBe(24 * 60 + 120);
  expect(shift(b.id).delta).toBe(24 * 60 + 120);
  expect(shift(a.id).length).toBe(shift(a.id).wasLength);
  // C was not selected and stays put.
  const c = before.find((event) => event.startAt.includes('T21:00'))!;
  expect(after.find((event) => event.id === c.id)).toEqual(c);
  expect(after).toHaveLength(3);
  // One undo puts both back.
  await page.keyboard.press('Control+z');
  await settle(page);
  expect(await stored(page)).toEqual(before);
});

test('[TC-18][AC-04.3,FR-13] Escape during a batch drag puts every block back and writes nothing', async ({ page }) => {
  const before = await stored(page);
  await selectAAndB(page);
  await dragBlock(page, await point(page, 0, 10, 30), await point(page, 1, 12, 30), false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settle(page);
  expect(await stored(page)).toEqual(before);
  await expect(selected(page)).toHaveCount(2);
});

test('[TC-18][AC-04.3,FR-13] releasing a batch drag outside the calendar puts every block back and writes nothing', async ({ page }) => {
  const before = await stored(page);
  await selectAAndB(page);
  const grid = await box(page.getByTestId('calendar-columns'));
  await dragBlock(page, await point(page, 0, 10, 30), { x: grid.x - 40, y: grid.y + 200 });
  await settle(page);
  expect(await stored(page)).toEqual(before);
  await expect(selected(page)).toHaveCount(2);
});

test('[TC-18][AC-04.4,FR-14] Delete removes every selected block and its file, with no confirmation, and one undo brings them back', async ({ page }) => {
  const before = await stored(page);
  await selectAAndB(page);
  await page.keyboard.press('Delete');
  await settle(page);
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  expect(await stored(page)).toHaveLength(1);
  await page.keyboard.press('Control+z');
  await settle(page);
  await expect(page.getByTestId('event-block')).toHaveCount(3);
  expect(await stored(page)).toEqual(before);
});

// 票 026c 追加（2026-11-06，專案擁有者選方案 1）：多選時右側面板不顯示，另提供可見的刪除入口。
test('[TC-18][AC-04.4,FR-14] with several blocks selected a selection bar shows the count, and its Delete button removes them all in one undo step', async ({ page }) => {
  const before = await stored(page);
  await selectAAndB(page);
  const bar = page.getByTestId('selection-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('2 selected');
  await page.getByTestId('selection-delete').click();
  await settle(page);
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  expect(await stored(page)).toHaveLength(1);
  await expect(bar).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await settle(page);
  await expect(page.getByTestId('event-block')).toHaveCount(3);
  expect(await stored(page)).toEqual(before);
});

test('[TC-18][AC-04.4,FR-14] the selection bar shows only for two or more selected blocks, never together with the inspector', async ({ page }) => {
  const bar = page.getByTestId('selection-bar');
  await expect(bar).toHaveCount(0); // nothing selected
  const one = await point(page, 1, 11);
  await page.mouse.click(one.x, one.y);
  await settle(page);
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(bar).toHaveCount(0); // one block: the inspector, not the bar
  await selectAAndB(page);
  await expect(bar).toBeVisible();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  const empty = await point(page, 3, 9);
  await page.mouse.click(empty.x, empty.y);
  await settle(page);
  await expect(bar).toHaveCount(0); // selection cleared
});

test('[TC-18][AC-04.4,FR-14] after Delete on the keyboard the selection bar is gone and the unselected block is untouched', async ({ page }) => {
  const before = await stored(page);
  await selectAAndB(page);
  await expect(page.getByTestId('selection-bar')).toBeVisible();
  await page.keyboard.press('Backspace');
  await settle(page);
  await expect(page.getByTestId('selection-bar')).toHaveCount(0);
  const rest = await stored(page);
  expect(rest).toHaveLength(1);
  expect(rest[0]).toEqual(before.find((event) => event.id === rest[0]!.id));
});
