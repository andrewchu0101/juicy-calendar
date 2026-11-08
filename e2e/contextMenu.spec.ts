import { expect, test, type Page } from '@playwright/test';

async function openEvents(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(() => {
    for (const [id, startAt, endAt] of [
      ['menu-a', '2026-11-02T15:00:00.000Z', '2026-11-02T17:00:00.000Z'],
      ['menu-b', '2026-11-03T15:00:00.000Z', '2026-11-03T17:00:00.000Z'],
    ]) localStorage.setItem(`juicy-calendar:file:events/${id}.json`, JSON.stringify({
      id, templateId: 'coding', title: id, color: '#E98B87', startAt, endAt,
    }));
  });
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(2);
}

async function selectGroup(page: Page) {
  const now = new Date('2026-11-02T12:00:00-05:00');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.move(box.x + box.width * 2.5 / 7, box.y + 360);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 / 7, box.y + 150, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-testid="event-block"][data-selected="true"]')).toHaveCount(2);
}

test('[TC-21.1,TC-21.2][AC-07.1,FR-18] selected-event right click preserves the group, writes nothing, and deletes as one history step', async ({ page }) => {
  await openEvents(page);
  await selectGroup(page);
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.locator('[data-event-id="menu-a"]').click({ button: 'right' });
  await expect(page.locator('[data-testid="event-block"][data-selected="true"]')).toHaveCount(2);
  await expect(page.getByRole('menuitem', { name: /Rename/ })).toHaveCount(0);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('event-block')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
});

test('[TC-21.1][AC-07.1,FR-18] right-clicking an unselected event replaces a previous selection', async ({ page }) => {
  await openEvents(page);
  await page.locator('[data-event-id="menu-a"]').click();
  await page.locator('[data-event-id="menu-b"]').click({ button: 'right' });
  await expect(page.locator('[data-event-id="menu-a"]')).toHaveAttribute('data-selected', 'false');
  await expect(page.locator('[data-event-id="menu-b"]')).toHaveAttribute('data-selected', 'true');
});

test('[TC-21.5][AC-07.3,FR-19] text inputs keep the native context menu and excluded surfaces have no custom menu', async ({ page }) => {
  await openEvents(page);
  await page.locator('[data-event-id="menu-a"]').dblclick();
  const input = page.getByTestId('event-title-input');
  const prevented = await input.evaluate(element => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  for (const locator of [page.getByTestId('day-header').first(), page.getByTestId('template-ball').first(), page.getByTestId('timeline-label').nth(1)]) {
    await locator.click({ button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(0);
  }
});

test('[TC-21.2][AC-07.1,FR-18] event Copy supplies the shared Paste action', async ({ page }) => {
  await openEvents(page);
  await page.locator('[data-event-id="menu-a"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Copy/ }).click({ timeout: 5000 });
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.click(box.x + box.width * 2.5 / 7, box.y + 180, { button: 'right' });
  await page.getByRole('menuitem', { name: /Paste/ }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(3);
});

test('[TC-21.2][AC-07.1,FR-18] Rename opens the existing title editor for a single event', async ({ page }) => {
  await openEvents(page);
  await page.locator('[data-event-id="menu-a"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Rename/ }).click({ timeout: 5000 });
  await page.getByTestId('event-title-input').fill('Renamed');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-event-id="menu-a"]').getByTestId('event-title')).toHaveText('Renamed');
});

test('[TC-21.2][AC-07.2,FR-18] empty-time Undo and Redo share event history and disabled states', async ({ page }) => {
  await openEvents(page);
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  const rightClick = () => page.mouse.click(box.x + box.width * 2.5 / 7, box.y + 180, { button: 'right' });
  await rightClick();
  await expect(page.getByRole('menuitem', { name: /Undo/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /Redo/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.locator('[data-event-id="menu-a"]').click();
  await page.keyboard.press('Delete');
  await rightClick();
  await page.getByRole('menuitem', { name: /Undo/ }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await rightClick();
  await page.getByRole('menuitem', { name: /Redo/ }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
});

test('[TC-21.4][AC-07.3,FR-19,R-12] dismissing outside preserves selection and consumes only that click', async ({ page }) => {
  await openEvents(page);
  const a = page.locator('[data-event-id="menu-a"]');
  await a.click();
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.click(box.x + box.width * 2.5 / 7, box.y + 180, { button: 'right' });
  await page.mouse.click(box.x + box.width * 3.5 / 7, box.y + 60);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(a).toHaveAttribute('data-selected', 'true');
  await page.mouse.click(box.x + box.width * 3.5 / 7, box.y + 60);
  await expect(a).toHaveAttribute('data-selected', 'false');
});

test('[TC-21.4][AC-07.3,FR-19,R-12] menu keyboard navigation owns commands and restores focus on Escape', async ({ page }) => {
  await openEvents(page);
  const a = page.locator('[data-event-id="menu-a"]');
  await page.getByTestId('range-label').click();
  await a.click({ button: 'right' });
  const copy = page.getByRole('menuitem', { name: /Copy/ });
  await expect(copy).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Delete/ })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(a).toHaveAttribute('data-selected', 'true');
  await expect(a).toBeFocused();
});

test('[TC-21.4][AC-07.3,FR-19] scrolling closes the menu without clearing the selected event', async ({ page }) => {
  await openEvents(page);
  const a = page.locator('[data-event-id="menu-a"]');
  await a.click({ button: 'right' });
  await page.getByTestId('calendar-scroller').evaluate(element => { element.scrollTop = 100; });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(a).toHaveAttribute('data-selected', 'true');
});

test('[TC-21.5][AC-07.3,FR-19,R-12] an active radial gesture refuses a context menu', async ({ page }) => {
  await openEvents(page);
  const box = await page.getByTestId('calendar-columns').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.move(box.x + box.width * 2.5 / 7, box.y + 180);
  await page.mouse.down();
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('[TC-21.6][AC-07.3,FR-19] the menu fits the bottom-right edge at 900 by 560', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 560 });
  await openEvents(page);
  const box = await page.getByTestId('calendar-scroller').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20, { button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const rect = await menu.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(900);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(560);
});

test('[TC-21.5][AC-07.3,FR-19,R-12] a contextmenu request during marquee is rejected', async ({ page }) => {
  await openEvents(page);
  const columns = page.getByTestId('calendar-columns');
  const box = await columns.boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.move(box.x + box.width * 3.5 / 7, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 2.5 / 7, box.y + 120);
  await expect(page.getByTestId('marquee')).toBeVisible();
  await columns.dispatchEvent('contextmenu', { clientX: box.x + 200, clientY: box.y + 100 });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('[TC-21.5][AC-07.3,FR-19,R-12] an earlier right-click target cannot reopen the menu during a drag', async ({ page }) => {
  await openEvents(page);
  const columns = page.getByTestId('calendar-columns');
  const box = await columns.boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.click(box.x + box.width * 2.5 / 7, box.y + 60, { button: 'right' });
  await page.keyboard.press('Escape');
  await page.locator('[data-event-id="menu-a"]').hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 1.5 / 7, box.y + 200, { steps: 4 });
  await expect(page.getByTestId('drag-chip')).toBeVisible();
  await columns.dispatchEvent('contextmenu', { clientX: box.x + 200, clientY: box.y + 100 });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('[TC-21.2][AC-07.1,FR-18] right-clicking an unselected event selects it and Delete removes it in one undo step', async ({ page }) => {
  await openEvents(page);
  const event = page.locator('[data-event-id="menu-a"]');
  await event.click({ button: 'right' });
  await expect(event).toHaveAttribute('data-selected', 'true');
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('event-block')).toHaveCount(2);
});

test('[TC-21.1][AC-07.2,FR-18] right-clicking empty calendar time preserves the selected group', async ({ page }) => {
  // Each test gets a disposable browser context and localStorage workspace, never a native workspace.
  const now = new Date('2026-11-02T12:00:00-05:00');
  await page.clock.setFixedTime(now);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(() => {
    const events = [
      { id: 'context-a', templateId: 'coding', title: 'A', color: '#E98B87',
        startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z' },
      { id: 'context-b', templateId: 'coding', title: 'B', color: '#E98B87',
        startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-03T17:00:00.000Z' },
    ];
    for (const event of events) {
      localStorage.setItem(`juicy-calendar:file:events/${event.id}.json`, JSON.stringify(event));
    }
  });
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(2);
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');
  const width = columns.width / 7;
  // Wednesday 14:00 to Monday 10:30 intersects A and B; the frozen timer prevents a long press.
  await page.mouse.move(columns.x + width * 2.5, columns.y + 360);
  await page.mouse.down();
  await page.mouse.move(columns.x + width * 0.5, columns.y + 150, { steps: 4 });
  await page.mouse.up();
  const selected = page.locator('[data-testid="event-block"][data-selected="true"]');
  await expect(selected).toHaveCount(2);
  await expect(page.locator('[data-event-id="context-a"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-event-id="context-b"]')).toHaveAttribute('data-selected', 'true');

  await page.mouse.click(columns.x + width * 2.5, columns.y + 60, { button: 'right' });

  await expect(selected).toHaveCount(2);
  await expect(page.locator('[data-event-id="context-a"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-event-id="context-b"]')).toHaveAttribute('data-selected', 'true');
});

test('[TC-21.2][AC-07.2,FR-18] right-clicking empty calendar time opens a context menu', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');

  await page.mouse.click(columns.x + columns.width * 2.5 / 7, columns.y + 60, { button: 'right' });

  await expect(page.getByRole('menu')).toBeVisible();
});

test('[TC-21.2][AC-07.2,FR-18] an empty clipboard disables Paste in the empty-time menu', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');
  await page.mouse.click(columns.x + columns.width * 2.5 / 7, columns.y + 60, { button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  await expect(menu.getByRole('menuitem', { name: /Paste/ })).toBeDisabled();
});

test('[TC-21.2][AC-07.2,FR-18] Paste from the empty-time menu creates a copy of the selected event', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(() => {
    localStorage.setItem('juicy-calendar:file:events/context-source.json', JSON.stringify({
      id: 'context-source', templateId: 'coding', title: 'Source', color: '#E98B87',
      startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z',
    }));
  });
  await page.reload();
  await page.locator('[data-event-id="context-source"]').click();
  await expect(page.locator('[data-event-id="context-source"]')).toHaveAttribute('data-selected', 'true');
  await page.keyboard.press('Control+c');
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');
  await page.mouse.click(columns.x + columns.width * 2.5 / 7, columns.y + 180, { button: 'right' });
  const paste = page.getByRole('menuitem', { name: /Paste/ });
  await expect(paste).toBeEnabled();

  await paste.click();

  await expect(page.getByTestId('event-block')).toHaveCount(2);
});

test('[TC-21.3][AC-07.2,FR-18,R-12] moving to Paste preserves the right-press day and time', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(() => {
    localStorage.setItem('juicy-calendar:file:events/context-source.json', JSON.stringify({
      id: 'context-source', templateId: 'coding', title: 'Source', color: '#E98B87',
      startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:30:00.000Z',
    }));
  });
  await page.reload();
  await page.locator('[data-event-id="context-source"]').click();
  await page.keyboard.press('Control+c');
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');
  // Wednesday 11:00; the source lasts 150 minutes, so the copy ends at 13:30.
  await page.mouse.click(columns.x + columns.width * 2.5 / 7, columns.y + 180, { button: 'right' });
  await page.getByRole('menuitem', { name: /Paste/ }).hover();
  await page.getByRole('menuitem', { name: /Paste/ }).click();

  const copy = page.getByTestId('day-column').nth(2).getByTestId('event-block');
  await expect(copy).toHaveCount(1);
  await expect(copy.getByTestId('event-time')).toHaveText('11:00–13:30');
});

test('[TC-21.4][AC-07.3,FR-19,R-12] Escape closes the empty-time menu', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  const columns = await page.getByTestId('calendar-columns').boundingBox();
  if (!columns) throw new Error('calendar has no box');
  await page.mouse.click(columns.x + columns.width * 2.5 / 7, columns.y + 60, { button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu')).toHaveCount(0);
});
