import { afterEach, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri: () => true }));

import { useI18nStore } from '../../i18n/i18n';
import { backend } from './backend';

afterEach(() => {
  invoke.mockReset();
  useI18nStore.setState({ language: 'en' });
});

it('[TC-11][FR-09,AGENTS-11] native folder selection receives the current dictionary title for each mode', async () => {
  invoke.mockResolvedValue(null);
  useI18nStore.setState({ language: 'zh-TW' });

  await backend.select('create');
  expect(invoke).toHaveBeenLastCalledWith('workspace_select', { mode: 'create', title: '建立工作區' });
  await backend.select('open');
  expect(invoke).toHaveBeenLastCalledWith('workspace_select', { mode: 'open', title: '開啟工作區' });

  useI18nStore.setState({ language: 'en' });
  await backend.select('create');
  expect(invoke).toHaveBeenLastCalledWith('workspace_select', { mode: 'create', title: 'Create workspace' });
  await backend.select('open');
  expect(invoke).toHaveBeenLastCalledWith('workspace_select', { mode: 'open', title: 'Open workspace' });
});
