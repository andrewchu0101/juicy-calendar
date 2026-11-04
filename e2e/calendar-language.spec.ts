import { expect, test, type Page } from '@playwright/test';

// TC-11｜FR-09、SRS R-7、票 011：日曆與工具列的固定文字、aria-label、title 依語言顯示。
// 固定時鐘：2026-11-02（星期一），所以本週是 11/2–11/8。英文預期 = 票 011 之前畫面上的文字。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const KEY = 'juicy-calendar:file:';

const COLOR = '#E98B87';
// 05:00 EST 在 08:00→03:00 的可見時段之外（會計入 +1）；10:00 EST 在可見時段內。
const HIDDEN = { id: 'hidden-1', templateId: 'coding', title: 'Early', startAt: '2026-11-02T10:00:00.000Z', endAt: '2026-11-02T11:00:00.000Z', color: COLOR };
const VISIBLE = { id: 'visible-1', templateId: 'coding', title: 'Shown', startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z', color: COLOR };

async function openWithEvents(page: Page, createLabel: string) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: createLabel }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(
    ({ key, events }) => {
      for (const event of events) localStorage.setItem(`${key}events/${event.id}.json`, JSON.stringify(event));
    },
    { key: KEY, events: [HIDDEN, VISIBLE] },
  );
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
}

test.describe('English (system language en-US)', () => {
  test.use({ locale: 'en-US' });

  test('TC-11 calendar and toolbar keep their English texts', async ({ page }) => {
    await openWithEvents(page, 'Create workspace');
    await expect(page.getByRole('button', { name: 'Previous period' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next period' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(page.getByLabel('Timeline start')).toBeVisible();
    await expect(page.getByLabel('Timeline end')).toBeVisible();
    await expect(page.getByLabel('30 minute magnet')).toBeVisible();
    await expect(page.getByText('30 min magnet')).toBeVisible();
    await expect(page.getByLabel('Zoom')).toBeVisible();
    const view = page.getByRole('group', { name: 'View' });
    await expect(view.getByRole('button', { name: 'week' })).toBeVisible();
    await expect(view.getByRole('button', { name: 'day' })).toBeVisible();

    await expect(page.getByTestId('range-label')).toHaveText('Nov 2 – 8, 2026');
    const first = page.getByTestId('day-header').first();
    await expect(first).toContainText('Mon');
    await expect(first).toHaveAttribute('title', 'Open Monday');
    await expect(page.getByTestId('hidden-count')).toHaveAttribute('title', '1 event outside the visible hours');

    await page.getByTestId('event-block').dblclick();
    await expect(page.getByLabel('Event name')).toBeVisible();
  });
});

test.describe('繁體中文 (system language zh-TW)', () => {
  test.use({ locale: 'zh-TW' });

  test('TC-11 calendar and toolbar are fully translated', async ({ page }) => {
    await openWithEvents(page, '建立工作區');
    await expect(page.getByRole('button', { name: '上一個期間' })).toBeVisible();
    await expect(page.getByRole('button', { name: '下一個期間' })).toBeVisible();
    await expect(page.getByRole('button', { name: '今天' })).toBeVisible();
    await expect(page.getByLabel('時間軸起點')).toBeVisible();
    await expect(page.getByLabel('時間軸終點')).toBeVisible();
    await expect(page.getByLabel('30 分鐘吸附')).toBeVisible();
    await expect(page.getByLabel('縮放')).toBeVisible();
    const view = page.getByRole('group', { name: '檢視' });
    await expect(view.getByRole('button', { name: '週' })).toBeVisible();
    await expect(view.getByRole('button', { name: '日' })).toBeVisible();

    await expect(page.getByTestId('range-label')).toHaveText('2026年11月2日 – 8日');
    const first = page.getByTestId('day-header').first();
    await expect(first).toContainText('週一');
    await expect(first).toHaveAttribute('title', '開啟星期一');
    await expect(page.getByTestId('hidden-count')).toHaveAttribute('title', '有 1 個事件在可見時段之外');

    await page.getByRole('button', { name: '下一個期間' }).click();
    await expect(page.getByTestId('range-label')).toHaveText('2026年11月9日 – 15日');
    await view.getByRole('button', { name: '日' }).click();
    await expect(page.getByTestId('range-label')).toHaveText(/^2026年11月\d+日 星期[一二三四五六日]$/);
    await view.getByRole('button', { name: '週' }).click();
    await page.getByRole('button', { name: '今天' }).click();

    await page.getByTestId('event-block').dblclick();
    await expect(page.getByLabel('事件名稱')).toBeVisible();
  });

  test('TC-11 the language chosen on the welcome screen applies to the calendar at once', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.goto('/');
    await page.getByLabel('語言').selectOption({ label: 'English' });
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(page.getByTestId('range-label')).toHaveText('Nov 2 – 8, 2026');
  });
});
