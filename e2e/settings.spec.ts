import { expect, test } from '@playwright/test';

test('[TC-20.1][AC-06.1,FR-17] settings opens a separate page and returns to the same calendar position', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const scroller = page.getByTestId('calendar-scroller');
  await scroller.evaluate(element => { element.scrollTop = 140; });
  const before = await scroller.evaluate(element => element.scrollTop);
  const range = await page.getByTestId('range-label').textContent();
  await page.getByRole('button', { name: 'Settings', exact: true }).click({ timeout: 5000 });
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(scroller).not.toBeVisible();
  await page.getByRole('button', { name: 'Back to calendar' }).click();
  await expect(scroller).toBeVisible();
  expect(await scroller.evaluate(element => element.scrollTop)).toBe(before);
  await expect(page.getByTestId('range-label')).toHaveText(range!);
});

test('[TC-20.2][AC-06.1,AC-06.2,FR-17] editing workspace settings saves them and synchronizes the retained toolbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByTestId('settings-page');
  await settings.getByLabel('Timeline start').fill('7', { timeout: 5000 });
  await settings.getByLabel('Timeline end').fill('22');
  await settings.getByLabel('30 minute magnet').uncheck();
  await settings.getByLabel('Zoom', { exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'Back to calendar' }).click();
  await expect(page.getByLabel('Timeline start')).toHaveValue('7');
  await expect(page.getByLabel('Timeline end')).toHaveValue('22');
  await expect(page.getByLabel('30 minute magnet')).not.toBeChecked();
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('1.5');
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByLabel('Timeline start')).toHaveValue('7');
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('1.5');
});

test('[TC-20.5][AC-06.3,FR-17,R-12] settings blocks event Delete while preserving selection on return', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.evaluate(() => localStorage.setItem('juicy-calendar:file:events/settings-source.json', JSON.stringify({
    id: 'settings-source', templateId: 'coding', title: 'Keep', color: '#E98B87',
    startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z',
  })));
  await page.reload();
  const event = page.locator('[data-event-id="settings-source"]');
  await event.click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Back to calendar' }).click();
  await expect(event).toBeVisible();
  await expect(event).toHaveAttribute('data-selected', 'true');
});

for (const zoom of [0.4, 4]) {
  test(`[TC-20.3,TC-20.4][AC-06.2,AC-06.3,FR-17,R-11] settings preserves legacy zoom ${zoom} and restores invalid page edits`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await page.evaluate(value => {
      const key = 'juicy-calendar:file:settings.json';
      const settings = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(key, JSON.stringify({ ...settings, pixelsPerMinute: value }));
    }, zoom);
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByTestId('settings-page');
    const input = settings.getByLabel('Zoom', { exact: true });
    await expect(input).toHaveValue(String(zoom));
    const before = await page.evaluate(() => localStorage.getItem('juicy-calendar:file:settings.json'));
    await input.fill('0.49');
    await expect(input).toHaveValue(String(zoom));
    await settings.getByLabel('Timeline start').fill('-1');
    await expect(settings.getByLabel('Timeline start')).toHaveValue('8');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => localStorage.getItem('juicy-calendar:file:settings.json'))).toBe(before);
    await settings.getByLabel('30 minute magnet').uncheck();
    await expect(input).toHaveValue(String(zoom));
    await input.fill('0.5');
    await expect(input).toHaveValue('0.5');
    await input.fill('3');
    await expect(input).toHaveValue('3');
    await input.fill('3.01');
    await expect(input).toHaveValue('3');
  });
}

test('[TC-20.2,TC-20.6,TC-21.6][AC-06.1,AC-06.2,AC-07.3,FR-17,FR-19] Chinese settings and menu work at minimum size and language survives restart', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 560 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByTestId('settings-page');
  await settings.getByLabel('Language').selectOption('zh-TW');
  await expect(settings.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await expect(settings.getByRole('spinbutton')).toHaveCount(3);
  await expect(settings.getByRole('checkbox')).toHaveCount(1);
  expect(await settings.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/settings-zh-900.png' });
  await page.getByRole('button', { name: '返回日曆' }).click();
  const box = await page.getByTestId('calendar-scroller').boundingBox();
  if (!box) throw new Error('calendar has no box');
  await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: /貼上/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/context-menu-zh-900.png' });
  await page.reload();
  await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
});

test('[TC-20.5][AC-06.3,FR-17,R-12] settings isolates undo redo copy paste and Backspace while retaining native field keys', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.evaluate(() => localStorage.setItem('juicy-calendar:file:events/settings-source.json', JSON.stringify({
    id: 'settings-source', templateId: 'coding', title: 'Keep', color: '#E98B87',
    startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z',
  })));
  await page.reload();
  const event = page.locator('[data-event-id="settings-source"]');
  await event.dblclick();
  await page.getByTestId('event-title-input').fill('Keep edited');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const key of ['Control+z', 'Control+Shift+z', 'Control+c', 'Control+v', 'Backspace']) await page.keyboard.press(key);
  const settings = page.getByTestId('settings-page');
  const field = settings.getByLabel('Timeline start');
  expect(await field.evaluate(element => {
    const key = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true });
    element.dispatchEvent(key);
    return key.defaultPrevented;
  })).toBe(false);
  await settings.click({ button: 'right', position: { x: 10, y: 10 } });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to calendar' }).click();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  await expect(event.getByTestId('event-title')).toHaveText('Keep edited');
  await expect(event).toHaveAttribute('data-selected', 'true');
});

test('[TC-20.5][AC-06.2,FR-17,FR-11] failed language save retains the new language and shows only the translated error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'juicy-calendar:app-settings') throw new Error('private-diagnostic');
      set.call(this, key, value);
    };
  });
  const settings = page.getByTestId('settings-page');
  await settings.getByLabel('Language').selectOption('zh-TW');
  await expect(settings.getByRole('heading')).toHaveText('設定');
  await expect(settings.getByRole('alert')).toHaveText('無法儲存語言設定。');
  await expect(page.getByText('private-diagnostic')).toHaveCount(0);
});
