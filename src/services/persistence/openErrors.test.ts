import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildWorkspaceFixture } from '../../test-support/workspaceFixture';
import { loadWorkspace, WorkspaceOpenError } from './repository';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const snapshot = (files: Map<string, string>) => new Map([...files].map(([path, text]) => [path, sha256(text)]));

async function openFailure(backend: Parameters<typeof loadWorkspace>[0]): Promise<unknown> {
  try {
    await loadWorkspace(backend);
  } catch (error) {
    return error;
  }
  throw new Error('loadWorkspace unexpectedly succeeded');
}

describe('通知代碼 (AC-02.2, SDS UI-02)', () => {
  it('壞檔略過：FILE_SKIPPED 帶檔案路徑與原因，該檔不被修改', async () => {
    const { backend, files } = buildWorkspaceFixture({
      rawFiles: { 'events/bad.json': '{ not json' },
    });

    const loaded = await loadWorkspace(backend);

    expect(loaded.issues).toEqual([{ code: 'FILE_SKIPPED', file: 'events/bad.json', detail: 'invalid JSON' }]);
    expect(files.get('events/bad.json')).toBe('{ not json');
  });
});

describe('通知代碼：設定重設 (AC-02.2, SDS UI-02)', () => {
  it('settings.json 損毀：SETTINGS_RESET，舊檔另存為 settings.corrupt.json', async () => {
    const { backend, files } = buildWorkspaceFixture();
    files.set('settings.json', '{{');

    const loaded = await loadWorkspace(backend);

    expect(loaded.issues).toEqual([{ code: 'SETTINGS_RESET' }]);
    expect(files.get('settings.corrupt.json')).toBe('{{');
  });
});

describe('TC-08 拒絕開啟 (FR-06, AC-02.2)', () => {
  // 預期值來自 docs/06-test-plan.md TC-08：版本 3 → WORKSPACE_TOO_NEW，資料夾清單與雜湊不變。
  it('workspace.json 版本為 3：WORKSPACE_TOO_NEW 並帶版本號，資料夾不變', async () => {
    const { backend, files } = buildWorkspaceFixture();
    files.set('workspace.json', '{"schemaVersion":3,"name":"Future","createdAt":"2026-11-01T00:00:00.000Z"}\n');
    const before = snapshot(files);

    const error = await openFailure(backend);

    expect(error).toBeInstanceOf(WorkspaceOpenError);
    expect(error).toMatchObject({ code: 'WORKSPACE_TOO_NEW', version: 3 });
    expect(snapshot(files)).toEqual(before);
  });

  it('沒有 workspace.json：NO_WORKSPACE_JSON，資料夾不變', async () => {
    const { backend, files } = buildWorkspaceFixture();
    files.delete('workspace.json');
    const before = snapshot(files);

    const error = await openFailure(backend);

    expect(error).toBeInstanceOf(WorkspaceOpenError);
    expect(error).toMatchObject({ code: 'NO_WORKSPACE_JSON' });
    expect(snapshot(files)).toEqual(before);
  });

  it('workspace.json 無法解析：WORKSPACE_DAMAGED，資料夾不變', async () => {
    const { backend, files } = buildWorkspaceFixture();
    files.set('workspace.json', '{ not json');
    const before = snapshot(files);

    const error = await openFailure(backend);

    expect(error).toBeInstanceOf(WorkspaceOpenError);
    expect(error).toMatchObject({ code: 'WORKSPACE_DAMAGED' });
    expect(snapshot(files)).toEqual(before);
  });
});
