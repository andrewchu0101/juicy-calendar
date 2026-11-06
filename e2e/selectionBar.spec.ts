import { expect, test, type Page } from '@playwright/test';

// 票 026c 追加｜多選的選取列放在日曆上方的工具列區域（專案擁有者 2026-11-06）：不得遮住週日標題、活動與常用工具；
// 窄視窗空間不足時可換行。TC-18、AC-04.4、FR-14；NFR-07（版面）。
// 限制：只檢查幾何與「點得到」（elementFromPoint、Playwright 的可操作性檢查），看不出好不好看；
// 專案目前沒有深色模式，`colorScheme: 'dark'` 只證明偏好深色時版面與可操作性不變，不是在驗深色配色。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const KEY = 'juicy-calendar:file:';
const EVENTS = [
  { id: 'a', startAt: '2026-11-02T15:00:00.000Z', endAt: '2026-11-02T17:00:00.000Z' }, // 週一 10:00
  { id: 'b', startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-03T17:00:00.000Z' }, // 週二 10:00
  { id: 'c', startAt: '2026-11-02T21:00:00.000Z', endAt: '2026-11-02T23:00:00.000Z' }, // 週一 16:00
].map((event) => ({ ...event, templateId: 'coding', title: 'Coding', color: '#E98B87' }));

async function open(page: Page, viewport: { width: number; height: number }, createLabel: string) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: createLabel }).click();
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

/** 框選週一與週二的 10:00 兩個區塊（從週三空白處往左上拉）。 */
async function selectAAndB(page: Page) {
  const grid = (await page.getByTestId('calendar-columns').boundingBox())!;
  const count = await page.getByTestId('day-column').count();
  const at = (column: number, hour: number, minute = 0) => ({
    x: grid.x + (grid.width / count) * (column + 0.5),
    y: grid.y + (hour - 8) * 60 + minute,
  });
  const from = at(2, 14);
  const to = at(0, 10, 30);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('[data-testid="event-block"][data-selected="true"]')).toHaveCount(2);
}

/** 選取列的版面問題清單；空陣列代表沒有問題。 */
async function problems(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const bar = document.querySelector<HTMLElement>('[data-testid="selection-bar"]');
    const toolbar = document.querySelector<HTMLElement>('[data-testid="calendar-toolbar"]')!;
    if (!bar) return ['selection bar missing'];
    if (!toolbar.contains(bar)) found.push('selection bar is not inside the toolbar');
    const barBox = bar.getBoundingClientRect();
    const hits = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const visible = (box: DOMRect) => box.width > 1 && box.height > 1;
    const name = (element: Element) => element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 20) ?? element.tagName;

    const headers = [...document.querySelectorAll<HTMLElement>('[data-testid="day-header"]')];
    if (headers.length !== 7) found.push(`expected 7 day headers, found ${headers.length}`);
    for (const header of headers) {
      const box = header.getBoundingClientRect();
      if (hits(barBox, box)) found.push(`bar overlaps day header ${name(header)}`);
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!top || !(header.contains(top) || top.contains(header))) found.push(`day header ${name(header)} is covered by ${top ? name(top) : 'nothing'}`);
    }
    for (const block of document.querySelectorAll<HTMLElement>('[data-testid="event-block"]')) {
      const box = block.getBoundingClientRect();
      if (visible(box) && hits(barBox, box)) found.push(`bar overlaps an event block ${name(block)}`);
    }
    for (const control of toolbar.querySelectorAll<HTMLElement>('button, select, input, h2')) {
      if (bar.contains(control)) continue;
      const box = control.getBoundingClientRect();
      if (!visible(box)) continue;
      if (hits(barBox, box)) found.push(`bar overlaps toolbar control ${name(control)}`);
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!top || !(control.contains(top) || top.contains(control) || control.closest('label')?.contains(top))) found.push(`toolbar control ${name(control)} is covered by ${top ? name(top) : 'nothing'}`);
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) found.push('horizontal scroll');
    return found;
  });
}

const gridTop = async (page: Page) => (await page.getByTestId('calendar-scroller').boundingBox())!.y;

for (const [label, locale, createLabel] of [
  ['English', 'en-US', 'Create workspace'],
  ['繁體中文', 'zh-TW', '建立工作區'],
] as const) {
  test.describe(`selection bar layout, ${label}`, () => {
    test.use({ locale });

    for (const [size, viewport] of [
      ['wide 1400×900', { width: 1400, height: 900 }],
      ['minimum 900×560', { width: 900, height: 560 }],
    ] as const) {
      test(`[TC-18][AC-04.4,FR-14,NFR-07] ${size}: the bar sits in the toolbar and covers no day header, block or tool (${label})`, async ({ page }) => {
        await open(page, viewport, createLabel);
        const topBefore = await gridTop(page);
        await selectAAndB(page);
        // 設 LAYOUT_SCREENSHOT_DIR 時順便存截圖，當作人工確認的證據（預設不寫檔）。
        if (process.env.LAYOUT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.LAYOUT_SCREENSHOT_DIR}/026c-bar-${locale}-${viewport.width}x${viewport.height}.png` });
        expect(await problems(page)).toEqual([]);
        // 寬視窗時列放得進同一行，日曆不得因為出現選取列而位移（否則框選後畫面會跳）。
        if (viewport.width >= 1400) expect(await gridTop(page)).toBe(topBefore);
        // 列上的刪除鈕與常用工具都點得到（Playwright 的可操作性檢查：可見、穩定、不被遮住）。
        await page.getByTestId('selection-delete').click({ trial: true });
        await page.getByRole('button', { name: /^(週|week)$/i }).click({ trial: true });
        await page.getByTestId('calendar-toolbar').getByRole('combobox').first().click({ trial: true });
      });
    }

    test(`[TC-18][AC-04.4,FR-14,NFR-07] 900×560 with a dark colour-scheme preference: same layout, still operable (${label})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await open(page, { width: 900, height: 560 }, createLabel);
      await selectAAndB(page);
      expect(await problems(page)).toEqual([]);
      await page.getByTestId('selection-delete').click();
      await expect(page.getByTestId('event-block')).toHaveCount(1);
    });
  });
}
