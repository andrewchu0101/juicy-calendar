import { expect, test, type Page } from '@playwright/test';

// M-04（自動輔助）｜NFR-07、SDS UI-06、票 019：最小視窗 900×560、30 個全形字的名稱、兩種語言。
// 限制：這只檢查幾何（捲動寬度、被剪裁的文字是否有省略號、元件外框是否互相遮蓋），
// 看不出「好不好看」或字體缺漏；視覺判斷仍由人工 M-04 與截圖負責。
// 固定時鐘：2026-11-02（星期一）。
const NOW = new Date('2026-11-02T12:00:00-05:00');
const KEY = 'juicy-calendar:file:';
const LONG_NAME = '一二三四五六七八九十'.repeat(3); // 30 個全形字，是名稱上限（AGENTS.md 規則 9）
const MIN_VIEWPORT = { width: 900, height: 560 }; // src-tauri/tauri.conf.json 的 minWidth／minHeight

const EVENT = {
  id: 'long-1',
  templateId: 'coding',
  title: LONG_NAME,
  startAt: '2026-11-02T15:00:00.000Z',
  endAt: '2026-11-02T17:00:00.000Z',
  color: '#E98B87',
};

async function openWithLongNames(page: Page, createLabel: string) {
  await page.setViewportSize(MIN_VIEWPORT);
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: createLabel }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate(
    ({ key, event, name }) => {
      localStorage.setItem(`${key}events/${event.id}.json`, JSON.stringify(event));
      const templatePath = Object.keys(localStorage).find((item) => item.startsWith(`${key}templates/`));
      const template = JSON.parse(localStorage.getItem(templatePath!)!);
      localStorage.setItem(templatePath!, JSON.stringify({ ...template, name }));
    },
    { key: KEY, event: EVENT, name: LONG_NAME },
  );
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  await page.getByTestId('event-block').click();
  // 票 027：900 寬放不下「面板＋完整一週」，面板預設收合成圓點；點圓點以浮層展開，之後的檢查照舊。
  await page.getByTestId('inspector-expand').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
}

/** 文字被剪裁（內容比容器寬）卻沒有省略號的元素；這是「未被截斷的溢出」。 */
async function untruncatedOverflow(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'OPTION') continue;
      if (element.clientWidth === 0 || element.scrollWidth <= element.clientWidth + 1) continue;
      const style = getComputedStyle(element);
      const clipped = style.overflowX === 'hidden' && style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap';
      const scrollable = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (clipped || scrollable) continue;
      // 視覺上隱藏、只給讀屏軟體的元素（sr-only，寬高 1px）不是使用者看得到的文字。
      if (element.getBoundingClientRect().width <= 1) continue;
      // 以 opacity 0 疊在圓形標籤上的原生控制項（自訂顏色）刻意被剪裁，溢出的不是文字。
      const children = [...element.children] as HTMLElement[];
      if (children.length > 0 && children.every((child) => child.tagName === 'INPUT' && getComputedStyle(child).opacity === '0')) continue;
      const label = element.getAttribute('data-testid') ?? element.className.toString().slice(0, 40);
      found.push(`${element.tagName.toLowerCase()}[${label}] scrollWidth ${element.scrollWidth} > clientWidth ${element.clientWidth}`);
    }
    return found;
  });
}

/** 面板與工具列的可操作控制項是否互相遮蓋（外框相交）。 */
async function inspectorCoversToolbar(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="inspector"]')!.getBoundingClientRect();
    const covered: string[] = [];
    for (const control of document.querySelectorAll<HTMLElement>('header button, header select, header input, header h2')) {
      const box = control.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const overlaps = box.left < panel.right && box.right > panel.left && box.top < panel.bottom && box.bottom > panel.top;
      if (overlaps) covered.push(control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName);
    }
    return covered;
  });
}

/** 另外放兩個很短的事件（15、5 分鐘），名稱同樣是 30 字；回傳它們的標題是否被截斷，以及區塊是否剪裁內容。 */
async function addShortEvents(page: Page) {
  await page.evaluate(
    ({ key, name }) => {
      const base = { templateId: 'coding', title: name, color: '#E98B87' };
      const shorts = [
        { ...base, id: 'short-15', startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-03T15:15:00.000Z' },
        { ...base, id: 'short-5', startAt: '2026-11-04T15:00:00.000Z', endAt: '2026-11-04T15:05:00.000Z' },
      ];
      for (const event of shorts) localStorage.setItem(`${key}events/${event.id}.json`, JSON.stringify(event));
    },
    { key: KEY, name: LONG_NAME },
  );
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(3);
}

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

for (const [label, locale, createLabel] of [
  ['English', 'en-US', 'Create workspace'],
  ['繁體中文', 'zh-TW', '建立工作區'],
] as const) {
  test.describe(`${label} at 900×560`, () => {
    test.use({ locale });

    test(`M-04 NFR-07 no horizontal scroll and no untruncated text overflow (${label})`, async ({ page }) => {
      await openWithLongNames(page, createLabel);
      // 設 LAYOUT_SCREENSHOT_DIR 時順便存截圖，當作 M-04 的證據（預設不寫檔）。
      if (process.env.LAYOUT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.LAYOUT_SCREENSHOT_DIR}/019-${locale}-900x560.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await untruncatedOverflow(page)).toEqual([]);
    });

    test(`M-04 NFR-07 a too-short block truncates the name and the panel still shows it in full (${label})`, async ({ page }) => {
      await openWithLongNames(page, createLabel);
      await addShortEvents(page);
      for (const id of ['short-15', 'short-5']) {
        const block = page.locator(`[data-testid="event-block"][data-event-id="${id}"]`);
        const clipped = await block.evaluate((element) => {
          const title = element.querySelector<HTMLElement>('[data-testid="event-title"]')!;
          const blockStyle = getComputedStyle(element);
          const titleStyle = getComputedStyle(title);
          return {
            blockClips: blockStyle.overflowX === 'hidden' && blockStyle.overflowY === 'hidden',
            titleEllipsis: titleStyle.textOverflow === 'ellipsis' && titleStyle.overflowX === 'hidden',
            titleNoWrap: titleStyle.whiteSpace === 'nowrap',
          };
        });
        expect(clipped, id).toEqual({ blockClips: true, titleEllipsis: true, titleNoWrap: true });
        await expect(block).toHaveAttribute('title', new RegExp(`^${LONG_NAME}`));
        await block.click({ position: { x: 4, y: 1 }, force: true });
        // 票 027：重新載入後 900 寬的面板是收合的圓點；點開才看得到完整名稱（已展開時不用再點）。
        if (await page.getByTestId('inspector-expand').count()) await page.getByTestId('inspector-expand').click();
        await expect(page.getByTestId('inspector-title')).toHaveValue(LONG_NAME);
      }
    });

    test(`M-04 NFR-07 the inspector does not cover toolbar controls (${label})`, async ({ page }) => {
      await openWithLongNames(page, createLabel);
      expect(await inspectorCoversToolbar(page)).toEqual([]);
    });
  });
}
