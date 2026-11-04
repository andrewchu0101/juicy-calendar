import { expect, test, type Page } from '@playwright/test';

// TC-12｜AC-03.3、FR-10、SRS R-7：時間顯示跟隨 12／24 小時設定，與介面語言無關。
// 瀏覽器模式沒有 Windows 的設定（hour12 為 null），所以走備援：Intl 的 hourCycle，由瀏覽器語系決定。
// 這裡以 locale 製造三種情況；Rust 回報 Windows 設定的路徑由 platform_win 的單元測試與桌面版人工驗收（M-05）負責。
// 固定時鐘 2026-11-02（星期一）；事件 10:30–12:30（America/New_York）。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const EVENT = {
  id: 'e1',
  templateId: 'coding',
  title: 'Shown',
  startAt: '2026-11-02T15:30:00.000Z',
  endAt: '2026-11-02T17:30:00.000Z',
  color: '#E98B87',
};

async function openWithEvent(page: Page, createLabel: string) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: createLabel }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate((event) => localStorage.setItem(`juicy-calendar:file:events/${event.id}.json`, JSON.stringify(event)), EVENT);
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
}

const optionTexts = (page: Page, label: string) => page.getByLabel(label).locator('option').allInnerTexts();

test.describe('24-hour clock (en-GB, English)', () => {
  test.use({ locale: 'en-GB' });
  test('TC-12 block range and timeline labels use 24 hours', async ({ page }) => {
    await openWithEvent(page, 'Create workspace');
    await expect(page.getByTestId('event-time')).toHaveText('10:30–12:30');
    const labels = await optionTexts(page, 'Timeline start');
    expect([labels[0], labels[8], labels[13], labels[23]]).toEqual(['00:00', '08:00', '13:00', '23:00']);
  });
});

test.describe('12-hour clock, English (en-US)', () => {
  test.use({ locale: 'en-US' });
  test('TC-12 block range and timeline labels use AM/PM', async ({ page }) => {
    await openWithEvent(page, 'Create workspace');
    await expect(page.getByTestId('event-time')).toHaveText('10:30 AM–12:30 PM');
    const labels = await optionTexts(page, 'Timeline start');
    expect([labels[0], labels[8], labels[13], labels[23]]).toEqual(['12:00 AM', '8:00 AM', '1:00 PM', '11:00 PM']);
  });
});

test.describe('12-hour clock, 繁體中文 (zh-TW)', () => {
  test.use({ locale: 'zh-TW' });
  test('TC-12 block range and timeline labels use 上午／下午', async ({ page }) => {
    await openWithEvent(page, '建立工作區');
    await expect(page.getByTestId('event-time')).toHaveText('上午 10:30–下午 12:30');
    const labels = await optionTexts(page, '時間軸起點');
    expect([labels[0], labels[8], labels[13], labels[23]]).toEqual(['上午 12:00', '上午 8:00', '下午 1:00', '下午 11:00']);
  });
});
