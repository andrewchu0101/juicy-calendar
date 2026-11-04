import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri: () => true }));

import { backend } from './backend';
import { BackendError } from './backendError';

describe('Tauri backend errors', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  // TC-10（路徑拒絕）、TC-08（代碼部分）｜每個命令的失敗都以帶代碼的 BackendError 呈現。
  it.each([
    ['select', () => backend.select('open'), 'NOT_A_WORKSPACE'],
    ['restore', () => backend.restore(), 'IO_ERROR'],
    ['close', () => backend.close(), 'IO_ERROR'],
    ['list', () => backend.list('events'), 'NO_WORKSPACE_OPEN'],
    ['read', () => backend.read('../x.json'), 'PATH_NOT_ALLOWED'],
    ['write', () => backend.write('../x.json', ''), 'PATH_NOT_ALLOWED'],
    ['remove', () => backend.remove('../x.json'), 'PATH_NOT_ALLOWED'],
  ] as const)('%s rejects with a BackendError carrying the code', async (_name, call, code) => {
    invoke.mockRejectedValue({ code, detail: 'diagnostic' });
    const error = await call().then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).code).toBe(code);
  });

  it('passes successful results through unchanged', async () => {
    invoke.mockResolvedValue('contents');
    await expect(backend.read('workspace.json')).resolves.toBe('contents');
  });
});
