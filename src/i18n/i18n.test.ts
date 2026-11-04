import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserBackend } from '../services/persistence/backend';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import type { Language } from './detectLanguage';
import type { Dictionary } from './dictionary';
import { initLanguage, setLanguage, setMissingKeyHandler, translate, useI18nStore } from './i18n';

// TC-11｜AC-03.2、FR-09、SRS R-7、SDS i18n 契約。預期值來自規格文字，不從實作推算。
const language = () => useI18nStore.getState().language;

function memoryBackend(saved: Language | null, locale: string | null) {
  const { backend } = buildWorkspaceFixture();
  let stored = saved;
  const writes: unknown[] = [];
  return {
    writes,
    backend: {
      ...backend,
      readAppSettings: async () => ({ language: stored }),
      writeAppSettings: async (settings: { language: Language }) => {
        writes.push(settings);
        stored = settings.language;
      },
      systemInfo: async () => ({ locale, hour12: null }),
    },
  };
}

beforeEach(() => useI18nStore.setState({ language: 'en', ready: false, saveError: null }));

describe('initLanguage (TC-11, AC-03.2)', () => {
  it('a saved language wins over the system language', async () => {
    const { backend, writes } = memoryBackend('zh-TW', 'en-US');
    await initLanguage(backend, ['en-US']);
    expect(language()).toBe('zh-TW');
    expect(useI18nStore.getState().ready).toBe(true);
    expect(writes).toEqual([]);
  });

  it.each([
    ['zh-HK', [], 'zh-TW'],
    ['zh-CN', [], 'zh-TW'],
    ['ja-JP', ['zh-TW'], 'en'],
    [null, ['zh-TW'], 'zh-TW'],
    [null, ['en-US'], 'en'],
    [null, [], 'en'],
  ] as const)('nothing saved, system %s, navigator %j → %s, and nothing is written', async (locale, navigatorLanguages, expected) => {
    const { backend, writes } = memoryBackend(null, locale);
    await initLanguage(backend, navigatorLanguages);
    expect(language()).toBe(expected);
    expect(writes).toEqual([]);
  });

  it('a settings read that fails counts as "not set": the app still starts with the detected language', async () => {
    const { backend } = memoryBackend(null, 'zh-TW');
    const failing = { ...backend, readAppSettings: async () => Promise.reject(new Error('unreadable')) };
    await initLanguage(failing, []);
    expect(language()).toBe('zh-TW');
    expect(useI18nStore.getState().ready).toBe(true);
  });

  it('a damaged settings value uses the detected language and leaves the stored bytes alone', async () => {
    const data = new Map([['juicy-calendar:app-settings', '{ broken']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    vi.stubGlobal('navigator', { languages: ['zh-TW'], language: 'zh-TW' });
    try {
      await initLanguage(createBrowserBackend(), ['zh-TW']);
      expect(language()).toBe('zh-TW');
      expect(data.get('juicy-calendar:app-settings')).toBe('{ broken');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('setLanguage (TC-11, FR-09)', () => {
  it('takes effect immediately, before the save finishes', async () => {
    const { backend } = memoryBackend(null, 'zh-TW');
    let release: () => void = () => undefined;
    const slow = {
      ...backend,
      writeAppSettings: () => new Promise<void>((resolve) => (release = resolve)),
    };
    expect(language()).toBe('en'); // 起點是英文，所以切到 zh-TW 才能證明「立即生效」
    const pending = setLanguage('zh-TW', slow);
    expect(language()).toBe('zh-TW');
    release();
    await pending;
  });

  it('switching to en and starting again (a new session) gives en', async () => {
    const { backend, writes } = memoryBackend(null, 'zh-TW');
    await initLanguage(backend, []);
    expect(language()).toBe('zh-TW');
    await setLanguage('en', backend);
    expect(writes).toEqual([{ language: 'en' }]);

    useI18nStore.setState({ language: 'zh-TW', ready: false, saveError: null }); // 模擬重新啟動前的任意狀態
    await initLanguage(backend, []);
    expect(language()).toBe('en');
  });

  // 票 010 決定（專案擁有者）：儲存失敗是錯誤通知，由 i18n 自己的狀態傳達；setLanguage 不再拒絕。
  it('a failed save keeps the new language, raises the error code and does not reject', async () => {
    const { backend } = memoryBackend(null, null);
    const failing = { ...backend, writeAppSettings: async () => Promise.reject(new Error('disk full: C:/secret/path')) };
    await expect(setLanguage('zh-TW', failing)).resolves.toBeUndefined();
    expect(language()).toBe('zh-TW');
    // 只有代碼：診斷文字（含本機路徑）不得進到畫面可讀的狀態。
    expect(useI18nStore.getState().saveError).toBe('LANGUAGE_SAVE_FAILED');
  });

  it('the error clears after the next successful save', async () => {
    const { backend } = memoryBackend(null, null);
    const failing = { ...backend, writeAppSettings: async () => Promise.reject(new Error('x')) };
    await setLanguage('zh-TW', failing);
    expect(useI18nStore.getState().saveError).toBe('LANGUAGE_SAVE_FAILED');
    await setLanguage('en', backend);
    expect(useI18nStore.getState().saveError).toBeNull();
  });

  it('starting up never raises the error', async () => {
    const { backend } = memoryBackend(null, 'zh-TW');
    await initLanguage(backend, []);
    expect(useI18nStore.getState().saveError).toBeNull();
  });

  it('the error sentence exists in both languages (AGENTS.md rule 11)', () => {
    expect(translate('en', 'language.saveFailed')).toBe('The language setting could not be saved.');
    expect(translate('zh-TW', 'language.saveFailed')).toBe('無法儲存語言設定。');
  });
});

describe('translate (TC-11, FR-09)', () => {
  it('returns the text of the chosen language', () => {
    expect(translate('en', 'welcome.create')).toBe('Create workspace');
    expect(translate('zh-TW', 'welcome.create')).toBe('建立工作區');
  });

  const sample = {
    en: { 'welcome.tagline': 'Hello {name}, {n} left. {name}!', 'welcome.create': 'Create', 'welcome.open': 'Open', 'language.label': 'Language' },
    'zh-TW': { 'welcome.tagline': '{name} 你好，剩 {n}。' } as unknown as Dictionary,
  } as Record<Language, Dictionary>;

  it('fills {params}, every occurrence', () => {
    expect(translate('en', 'welcome.tagline', { name: 'Yume', n: 3 }, sample)).toBe('Hello Yume, 3 left. Yume!');
    expect(translate('zh-TW', 'welcome.tagline', { name: '小明', n: 3 }, sample)).toBe('小明 你好，剩 3。');
  });

  describe('missing key', () => {
    const seen: Array<[Language, string]> = [];
    beforeEach(() => {
      seen.length = 0;
      setMissingKeyHandler((lang, key) => void seen.push([lang, key]));
    });
    afterEach(() => setMissingKeyHandler((lang, key) => console.error(`Missing translation: ${lang} ${key}`)));

    it('shows the English text and reports the key', () => {
      expect(translate('zh-TW', 'welcome.create', undefined, sample)).toBe('Create');
      expect(seen).toEqual([['zh-TW', 'welcome.create']]);
    });

    it('does not report when the key exists', () => {
      translate('en', 'welcome.create', undefined, sample);
      expect(seen).toEqual([]);
    });
  });
});
