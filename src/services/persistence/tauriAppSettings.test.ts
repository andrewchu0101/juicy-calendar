import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri: () => true }));

import { backend } from './backend';
import { BackendError } from './backendError';

// TC-10、TC-11｜FR-09、API-05、API-06：Tauri 版只透過專用命令讀寫，前端不傳任何路徑。
describe('Tauri backend app settings and system info', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('readAppSettings calls app_settings_read with no arguments and returns the language', async () => {
    invoke.mockResolvedValue({ language: 'zh-TW' });
    await expect(backend.readAppSettings()).resolves.toEqual({ language: 'zh-TW' });
    expect(invoke).toHaveBeenCalledWith('app_settings_read', undefined);
  });

  it.each([
    ['null language', { language: null }],
    ['unknown language', { language: 'fr' }],
    ['wrong type', { language: 5 }],
    ['not an object', 'garbage'],
    ['nothing', undefined],
  ])('readAppSettings treats a %s reply as "not set"', async (_label, reply) => {
    invoke.mockResolvedValue(reply);
    await expect(backend.readAppSettings()).resolves.toEqual({ language: null });
  });

  it('readAppSettings failure surfaces as a BackendError carrying the code', async () => {
    invoke.mockRejectedValue({ code: 'IO_ERROR', detail: 'diagnostic' });
    const error = await backend.readAppSettings().then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).code).toBe('IO_ERROR');
  });

  it('writeAppSettings sends only the language to app_settings_write', async () => {
    invoke.mockResolvedValue(undefined);
    await backend.writeAppSettings({ language: 'en' });
    expect(invoke).toHaveBeenCalledWith('app_settings_write', { settings: { language: 'en' } });
  });

  it('writeAppSettings refusal surfaces as a BackendError with IO_ERROR', async () => {
    invoke.mockRejectedValue({ code: 'IO_ERROR', detail: 'Unsupported language: fr' });
    const error = await backend.writeAppSettings({ language: 'en' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).code).toBe('IO_ERROR');
  });

  it('systemInfo calls system_info and passes locale and hour12 through', async () => {
    invoke.mockResolvedValue({ locale: 'zh-TW', hour12: true });
    await expect(backend.systemInfo()).resolves.toEqual({ locale: 'zh-TW', hour12: true });
    expect(invoke).toHaveBeenCalledWith('system_info', undefined);
  });

  it.each([
    ['nulls', { locale: null, hour12: null }, { locale: null, hour12: null }],
    ['wrong types', { locale: 5, hour12: 'yes' }, { locale: null, hour12: null }],
    ['garbage', 'garbage', { locale: null, hour12: null }],
    ['one bad field', { locale: 'en-US', hour12: 'yes' }, { locale: 'en-US', hour12: null }],
  ])('systemInfo with %s reply degrades to unknown values', async (_label, reply, expected) => {
    invoke.mockResolvedValue(reply);
    await expect(backend.systemInfo()).resolves.toEqual(expected);
  });

  it('systemInfo never rejects (API-06): a failed call means "unknown"', async () => {
    invoke.mockRejectedValue({ code: 'IO_ERROR', detail: 'boom' });
    await expect(backend.systemInfo()).resolves.toEqual({ locale: null, hour12: null });
  });
});
