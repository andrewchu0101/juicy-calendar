import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserBackend } from './backend';
import { BackendError } from './backendError';

// 瀏覽器版 backend（npm run dev 與 e2e）：語言存 localStorage，系統語系來自 navigator。
// 預期值來自 docs/06-test-plan.md TC-11 與 docs/05-sds.md API-05、API-06。
const KEY = 'juicy-calendar:app-settings';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
  };
}

describe('browser backend app settings (TC-11, FR-09, API-05)', () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('nothing saved → language is null and nothing is created', async () => {
    await expect(createBrowserBackend().readAppSettings()).resolves.toEqual({ language: null });
    expect(storage.data.has(KEY)).toBe(false);
  });

  it('writing en then reading again (a new backend, as after a restart) gives en', async () => {
    await createBrowserBackend().writeAppSettings({ language: 'en' });
    await expect(createBrowserBackend().readAppSettings()).resolves.toEqual({ language: 'en' });
    await createBrowserBackend().writeAppSettings({ language: 'zh-TW' });
    await expect(createBrowserBackend().readAppSettings()).resolves.toEqual({ language: 'zh-TW' });
  });

  it.each(['garbage', '', '{"language":"fr"}', '{"language":5}', '{"lang":"en"}', 'null'])(
    'damaged or invalid stored value %j → null, and the stored bytes stay the same',
    async (stored) => {
      storage.data.set(KEY, stored);
      await expect(createBrowserBackend().readAppSettings()).resolves.toEqual({ language: null });
      expect(storage.data.get(KEY)).toBe(stored);
    },
  );

  it('a damaged value is replaced only by the next valid write', async () => {
    storage.data.set(KEY, 'garbage');
    await createBrowserBackend().writeAppSettings({ language: 'en' });
    await expect(createBrowserBackend().readAppSettings()).resolves.toEqual({ language: 'en' });
  });

  it('writing an unknown language is refused with IO_ERROR and changes nothing', async () => {
    const backend = createBrowserBackend();
    const bad = { language: 'fr' } as unknown as { language: 'en' };
    const error = await backend.writeAppSettings(bad).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).code).toBe('IO_ERROR');
    expect(storage.data.has(KEY)).toBe(false);

    await backend.writeAppSettings({ language: 'en' });
    const before = storage.data.get(KEY);
    await backend.writeAppSettings(bad).catch(() => undefined);
    expect(storage.data.get(KEY)).toBe(before);
  });
});

describe('browser backend system info (API-06)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the first navigator language as the locale; hour12 is unknown', async () => {
    vi.stubGlobal('navigator', { languages: ['zh-TW', 'en-US'], language: 'zh-TW' });
    await expect(createBrowserBackend().systemInfo()).resolves.toEqual({ locale: 'zh-TW', hour12: null });
  });

  it('no navigator information → locale is null', async () => {
    vi.stubGlobal('navigator', { languages: [], language: '' });
    await expect(createBrowserBackend().systemInfo()).resolves.toEqual({ locale: null, hour12: null });
  });
});
