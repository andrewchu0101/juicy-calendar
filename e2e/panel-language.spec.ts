import { expect, test, type Page } from '@playwright/test';

// TC-11｜FR-09、SDS UI-01～UI-04、票 012：右側面板、模板編輯器、側邊球、通知與開啟錯誤依語言顯示。
// 固定時鐘：2026-11-02（星期一）。英文預期 = 票 012 之前畫面上的文字。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const KEY = 'juicy-calendar:file:';
const VISIBLE = {
  id: 'visible-1',
  templateId: 'coding',
  title: 'Shown',
  startAt: '2026-11-02T15:00:00.000Z',
  endAt: '2026-11-02T17:00:00.000Z',
  color: '#E98B87',
};

async function openWithEvent(page: Page, createLabel: string) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: createLabel }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(
    ({ key, event }) => {
      localStorage.setItem(`${key}events/${event.id}.json`, JSON.stringify(event));
      localStorage.setItem(`${key}events/broken.json`, '{oops');
    },
    { key: KEY, event: VISIBLE },
  );
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
}

test.describe('English (system language en-US)', () => {
  test.use({ locale: 'en-US' });

  test('TC-11 panel, editor, palette and notices keep their English texts', async ({ page }) => {
    await openWithEvent(page, 'Create workspace');
    await expect(page.getByText('Skipped events/broken.json: not a valid file. It was left untouched.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();

    await expect(page.getByTestId('template-ball').first()).toHaveAttribute('aria-label', 'Drag Coding onto the calendar');
    await expect(page.getByTestId('template-name').first()).toHaveAttribute('title', 'Edit Coding');
    await expect(page.getByRole('button', { name: 'Add template' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch' })).toBeVisible();

    await page.getByTestId('event-block').click();
    const panel = page.getByRole('region', { name: 'Event details' });
    await expect(panel).toBeVisible();
    for (const label of ['Name', 'Date', 'Start', 'End']) await expect(panel.getByLabel(label, { exact: true })).toBeVisible();
    await expect(panel.getByText('Duration (minutes) · 2h')).toBeVisible();
    await expect(panel.getByLabel('Duration in minutes')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Delete event' })).toBeVisible();
    await panel.getByRole('button', { name: 'Collapse inspector' }).click();
    await expect(page.getByRole('button', { name: 'Expand inspector' })).toBeVisible();
  });
});

test.describe('繁體中文 (system language zh-TW)', () => {
  test.use({ locale: 'zh-TW' });

  test('TC-11 panel, editor, palette and notices are fully translated', async ({ page }) => {
    await openWithEvent(page, '建立工作區');
    await expect(page.getByText('已略過 events/broken.json：不是有效的檔案，沒有動到它。')).toBeVisible();
    await expect(page.getByRole('button', { name: '關閉' })).toBeVisible();

    await expect(page.getByTestId('template-ball').first()).toHaveAttribute('aria-label', '將 Coding 拖到日曆上');
    await expect(page.getByTestId('template-name').first()).toHaveAttribute('title', '編輯 Coding');
    await expect(page.getByRole('button', { name: '新增模板' })).toBeVisible();
    await expect(page.getByRole('button', { name: '切換' })).toBeVisible();

    await page.getByTestId('event-block').click();
    const panel = page.getByRole('region', { name: '事件詳細資料' });
    await expect(panel).toBeVisible();
    for (const label of ['名稱', '日期', '開始', '結束']) await expect(panel.getByLabel(label, { exact: true })).toBeVisible();
    await expect(panel.getByText('持續時間（分鐘）· 2h')).toBeVisible();
    await expect(panel.getByLabel('持續分鐘數')).toBeVisible();
    await expect(panel.getByRole('button', { name: '刪除事件' })).toBeVisible();
    await panel.getByRole('button', { name: '收合面板' }).click();
    await expect(page.getByRole('button', { name: '展開面板' })).toBeVisible();

    await page.getByTestId('template-name').first().click();
    const editor = page.getByTestId('template-editor');
    await expect(editor.getByLabel('模板名稱')).toBeVisible();
    await expect(editor.getByLabel('預設時長')).toBeVisible();
    await expect(editor.getByText('先存起來備用。新區塊一律從 2 小時開始。')).toBeVisible();
    await expect(editor.getByRole('button', { name: '儲存' })).toBeVisible();
    await expect(editor.getByRole('button', { name: '取消' })).toBeVisible();
    await editor.getByRole('button', { name: '刪除' }).click();
    await expect(editor.getByRole('button', { name: '確認' })).toBeVisible();
  });

  test('TC-11 a damaged workspace.json is explained in 繁體中文 and left untouched', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '建立工作區' }).click();
    await expect(page.getByTestId('template-ball')).toHaveCount(6);
    await page.evaluate((key) => localStorage.setItem(`${key}workspace.json`, 'nope'), KEY);
    await page.reload();
    await expect(page.getByRole('alert')).toHaveText('workspace.json 已損毀，所以沒有開啟這個工作區。');
    expect(await page.evaluate((key) => localStorage.getItem(`${key}workspace.json`), KEY)).toBe('nope');
  });
});
