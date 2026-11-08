import { expect, it, vi } from 'vitest';
import { buildWorkspaceFixture } from '../test-support/workspaceFixture';
import { setLanguage, useI18nStore } from './i18n';

it('[TC-20.3][AC-06.3,FR-17,R-11] unknown language is rejected with no state change or app-settings write', async () => {
  const { backend } = buildWorkspaceFixture();
  useI18nStore.setState({ language: 'en', saveError: null });
  const before = useI18nStore.getState();
  const write = vi.spyOn(backend, 'writeAppSettings');
  await setLanguage('unknown', backend);
  expect.soft(useI18nStore.getState()).toBe(before);
  expect(write).not.toHaveBeenCalled();
});
