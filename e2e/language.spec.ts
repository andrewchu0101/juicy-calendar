import { expect, test, type Page } from '@playwright/test';

// TC-11｜AC-03.2、FR-09、SRS R-7：瀏覽器版 backend（localStorage 與 navigator）。
// 預設 locale 是 en-GB（英文、24 小時制，見 playwright.config.ts）；這裡以 test.use 逐組覆寫，不改全域設定。
const KEY = 'juicy-calendar:app-settings';
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

const ZH = { tagline: '安排你的時間。資料留在你自己的資料夾。', create: '建立工作區', open: '開啟工作區', label: '語言' };
const EN = { tagline: 'Arrange your time. Your data stays in a folder you own.', create: 'Create workspace', open: 'Open workspace', label: 'Language' };

async function expectWelcome(page: Page, texts: typeof ZH) {
  await expect(page.getByText(texts.tagline)).toBeVisible();
  await expect(page.getByRole('button', { name: texts.create })).toBeVisible();
  await expect(page.getByRole('button', { name: texts.open })).toBeVisible();
  await expect(page.getByLabel(texts.label)).toBeVisible();
}

for (const locale of ['zh-TW', 'zh-HK', 'zh-CN', 'zh']) {
  test.describe(`system language ${locale}`, () => {
    test.use({ locale });
    test(`TC-11 welcome screen is 繁體中文 and nothing is saved`, async ({ page }) => {
      await page.goto('/');
      await expectWelcome(page, ZH);
      expect(await stored(page)).toBeNull();
    });
  });
}

for (const locale of ['en-US', 'ja-JP']) {
  test.describe(`system language ${locale}`, () => {
    test.use({ locale });
    test(`TC-11 welcome screen is English and nothing is saved`, async ({ page }) => {
      await page.goto('/');
      await expectWelcome(page, EN);
      expect(await stored(page)).toBeNull();
    });
  });
}

test.describe('switching language', () => {
  test.use({ locale: 'en-US' });

  test('TC-11 takes effect at once and survives a restart', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(EN.label).selectOption({ label: '繁體中文' });
    await expectWelcome(page, ZH);
    await page.reload();
    await expectWelcome(page, ZH);
    expect(JSON.parse((await stored(page))!)).toEqual({ language: 'zh-TW' });

    await page.getByLabel(ZH.label).selectOption({ label: 'English' });
    await expectWelcome(page, EN);
    await page.reload();
    await expectWelcome(page, EN);
  });

  test('TC-11 a saved language wins over the system language', async ({ page }) => {
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, '{"language":"zh-TW"}');
    }, KEY);
    await page.goto('/');
    await expectWelcome(page, ZH);
  });

  test('TC-11 a damaged setting uses the detected language and stays untouched until the next switch', async ({ page }) => {
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, '{ broken');
      }
    }, KEY);
    await page.goto('/');
    await expectWelcome(page, EN);
    expect(await stored(page)).toBe('{ broken');
    await page.reload();
    await expectWelcome(page, EN);
    expect(await stored(page)).toBe('{ broken');

    await page.getByLabel(EN.label).selectOption({ label: '繁體中文' });
    await expectWelcome(page, ZH);
    expect(JSON.parse((await stored(page))!)).toEqual({ language: 'zh-TW' });
  });

  test('TC-11 a failed save shows an error, keeps the new language, and shows no diagnostic', async ({ page }) => {
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name: string, value: string) {
        if (name === key) throw new Error('disk full: C:/secret/path');
        return original.call(this, name, value);
      };
    }, KEY);
    await page.goto('/');
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByLabel(EN.label).selectOption({ label: '繁體中文' });
    await expectWelcome(page, ZH);
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('無法儲存語言設定。');
    await expect(alert).not.toContainText('secret');

    await page.getByLabel(ZH.label).selectOption({ label: 'English' });
    await expect(page.getByRole('alert')).toHaveText('The language setting could not be saved.');
  });
});
