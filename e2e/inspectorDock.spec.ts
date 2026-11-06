import { expect, test, type Page } from '@playwright/test';

// 票 027｜NFR-07：單選時的編輯面板。寬視窗固定佔版面（不遮日曆）；窄視窗（日曆放不下面板＋完整一週）自動收合成
// 右上角圓點，仍選著同一個活動，點圓點以浮層展開；視窗大小不覆寫使用者的收合偏好。
// 限制：只檢查幾何與狀態，看不出好不好看。固定時鐘 2026-11-02（週一）。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const KEY = 'juicy-calendar:file:';
const EVENTS = [
  { id: 'a', title: 'Alpha', startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z' }, // 週一 10:00
  { id: 'b', title: 'Beta', startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-03T17:00:00.000Z' }, // 週二 10:00
  { id: 'g', title: 'Gamma', startAt: '2026-11-08T15:00:00.000Z', endAt: '2026-11-08T17:00:00.000Z' }, // 週日 10:00
].map((event) => ({ ...event, templateId: 'coding', color: '#E98B87' }));

async function open(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(
    ({ key, events }) => {
      for (const event of events) localStorage.setItem(`${key}events/${event.id}.json`, JSON.stringify(event));
    },
    { key: KEY, events: EVENTS },
  );
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(3);
}

const block = (page: Page, id: string) => page.locator(`[data-testid="event-block"][data-event-id="${id}"]`);
const selectedIds = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="event-block"][data-selected="true"]')].map((b) => b.dataset.eventId));
const storedSettings = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(`${key}settings.json`) ?? '{}') as { inspectorCollapsed?: boolean }, KEY);

/** 某個元件（預設是面板）的外框與哪些東西相交；空陣列代表沒有遮住日期標題、日曆欄、區塊、工具列控制項。 */
async function covers(page: Page, testId = 'inspector') {
  return page.evaluate((id) => {
    const target = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.getBoundingClientRect();
    const hits = (b: DOMRect) => b.width > 1 && b.height > 1 && b.left < target.right && b.right > target.left && b.top < target.bottom && b.bottom > target.top;
    const found: string[] = [];
    document.querySelectorAll<HTMLElement>('[data-testid="day-header"]').forEach((h, i) => hits(h.getBoundingClientRect()) && found.push(`day-header ${i}`));
    document.querySelectorAll<HTMLElement>('[data-testid="day-column"]').forEach((c, i) => hits(c.getBoundingClientRect()) && found.push(`day-column ${i}`));
    document.querySelectorAll<HTMLElement>('[data-testid="event-block"]').forEach((c, i) => hits(c.getBoundingClientRect()) && found.push(`event-block ${i}`));
    document
      .querySelectorAll<HTMLElement>('[data-testid="calendar-toolbar"] button, [data-testid="calendar-toolbar"] select, [data-testid="calendar-toolbar"] input')
      .forEach((c) => hits(c.getBoundingClientRect()) && found.push(`toolbar ${c.getAttribute('aria-label') ?? c.tagName}`));
    return found;
  }, testId);
}

const calendarFitsWithoutScroll = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-testid="calendar-scroller"]')!;
    const sunday = [...document.querySelectorAll<HTMLElement>('[data-testid="day-header"]')].at(-1)!.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    return { noInnerHScroll: scroller.scrollWidth <= scroller.clientWidth, sundayVisible: sunday.right <= box.right + 1 };
  });

test('[NFR-07][UI-06,ticket 027] wide window: the panel takes its own space and covers no day, column or tool', async ({ page }) => {
  await open(page, { width: 1400, height: 900 });
  await block(page, 'a').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  expect(await covers(page)).toEqual([]);
  expect(await calendarFitsWithoutScroll(page)).toEqual({ noInnerHScroll: true, sundayVisible: true });
});

test('[NFR-07][UI-06,ticket 027] narrow window: the panel collapses to the dot, the same event stays selected, and the dot opens it for editing', async ({ page }) => {
  await open(page, { width: 900, height: 560 });
  await block(page, 'a').click();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await expect(page.getByTestId('inspector-expand')).toBeVisible();
  expect(await selectedIds(page)).toEqual(['a']);
  // 圓點本身也不得遮住週日標題、日曆欄、活動與工具列（圓點是窄視窗的預設狀態）。
  expect(await covers(page, 'inspector-expand')).toEqual([]);
  await page.getByTestId('inspector-expand').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.getByTestId('inspector-title').fill('Alpha 2');
  await page.getByTestId('inspector-title').press('Enter');
  await expect(block(page, 'a').getByTestId('event-title')).toHaveText('Alpha 2');
  expect(await selectedIds(page)).toEqual(['a']);
});

test('[NFR-07][UI-06,ticket 027] resizing narrow then wide keeps the selection and the panel follows the width', async ({ page }) => {
  await open(page, { width: 1400, height: 900 });
  await block(page, 'a').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('inspector-title')).toHaveValue('Alpha');

  await page.setViewportSize({ width: 900, height: 560 });
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await expect(page.getByTestId('inspector-expand')).toBeVisible();
  expect(await selectedIds(page)).toEqual(['a']);

  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('inspector-title')).toHaveValue('Alpha');
  expect(await selectedIds(page)).toEqual(['a']);
  await page.getByTestId('inspector-title').fill('Alpha 3');
  await page.getByTestId('inspector-title').press('Enter');
  await expect(block(page, 'a').getByTestId('event-title')).toHaveText('Alpha 3');
});

test('[NFR-07][UI-06,ticket 027] the window size never overwrites the saved collapsed preference', async ({ page }) => {
  await open(page, { width: 1400, height: 900 });
  await block(page, 'a').click();
  await page.getByTestId('inspector-collapse').click();
  await expect(page.getByTestId('inspector-expand')).toBeVisible();
  expect(await covers(page, 'inspector-expand')).toEqual([]); // the dot covers nothing in a wide window either
  await expect.poll(async () => (await storedSettings(page)).inspectorCollapsed).toBe(true); // the save is debounced

  await page.setViewportSize({ width: 900, height: 560 });
  await page.getByTestId('inspector-expand').click(); // narrow: only peeks, does not touch the preference
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.waitForTimeout(1000); // longer than the save debounce, so a stray write would have landed
  expect((await storedSettings(page)).inspectorCollapsed).toBe(true);

  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.getByTestId('inspector')).toHaveCount(0); // still collapsed by the user's own choice
  await expect(page.getByTestId('inspector-expand')).toBeVisible();
});

test('[NFR-07][UI-06,ticket 027] day view fits the panel even in the minimum window', async ({ page }) => {
  await open(page, { width: 900, height: 560 });
  await page.getByRole('button', { name: /^day$/i }).click();
  await page.getByTestId('event-block').first().click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  expect(await covers(page)).toEqual([]);
});
