import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { BackendError } from '../persistence/backendError';
import { restoreLastWorkspace, selectWorkspace } from './workspaceSession';

// 假的 backend：檔案放記憶體，select／restore 由各測試決定。不開啟任何真實資料夾。
const fake = vi.hoisted(() => {
  const files = new Map<string, string>();
  return {
    files,
    select: vi.fn(),
    restore: vi.fn(),
    close: vi.fn(async () => undefined),
    list: async (dir: string) =>
      [...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)),
    read: async (path: string) => files.get(path) ?? null,
    write: async (path: string, contents: string) => void files.set(path, contents),
    remove: async (path: string) => void files.delete(path),
  };
});
vi.mock('../persistence/backend', () => ({ backend: fake }));

beforeEach(() => {
  fake.files.clear();
  fake.select.mockReset();
  fake.restore.mockReset();
  useAppStore.getState().reset();
});

describe('開啟錯誤以代碼存入 store (TC-08, FR-06, FR-07, AC-02.2)', () => {
  it('資料夾被另一個視窗占用：openError 是 WORKSPACE_LOCKED，且不帶 detail', async () => {
    fake.select.mockRejectedValue(new BackendError('WORKSPACE_LOCKED', 'C:/secret/path'));

    await selectWorkspace('open');

    expect(useAppStore.getState().openError).toEqual({ code: 'WORKSPACE_LOCKED' });
  });

  // TC-10、FR-11、ADR-05 條件①：免安裝版 data 無法使用時，畫面顯示明確錯誤，不改存別處。
  it('免安裝版 data 無法使用：啟動還原的 openError 是 PORTABLE_DATA_UNAVAILABLE，且不帶 detail', async () => {
    fake.restore.mockRejectedValue(new BackendError('PORTABLE_DATA_UNAVAILABLE', 'C:/secret/path'));

    await restoreLastWorkspace();

    const state = useAppStore.getState();
    expect(state.openError).toEqual({ code: 'PORTABLE_DATA_UNAVAILABLE' });
    expect(state.booted).toBe(true);
  });

  it('workspace.json 版本為 3：openError 是 WORKSPACE_TOO_NEW 並帶版本號，沒有進入主畫面', async () => {
    fake.files.set('workspace.json', '{"schemaVersion":3,"name":"Future","createdAt":"2026-11-01T00:00:00.000Z"}\n');
    fake.select.mockResolvedValue({ path: 'D:/somewhere/Future', initialized: true });

    await selectWorkspace('open');

    const state = useAppStore.getState();
    expect(state.openError).toEqual({ code: 'WORKSPACE_TOO_NEW', version: 3 });
    expect(state.workspacePath).toBeNull();
  });

  it('其他失敗：OPEN_FAILED，診斷文字只放在 detail', async () => {
    fake.select.mockRejectedValue(new BackendError('IO_ERROR', 'disk exploded'));

    await selectWorkspace('open');

    expect(useAppStore.getState().openError).toEqual({ code: 'OPEN_FAILED', detail: 'disk exploded' });
  });
});
