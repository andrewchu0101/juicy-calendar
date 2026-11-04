import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { buildWorkspaceFixture, FIXTURE_NOW_ISO } from '../../test-support/workspaceFixture';
import { startPersistenceSync } from './persistenceSync';
import { loadWorkspace } from './repository';

describe('儲存錯誤以代碼存入 store (SDS UI-02, AC-02.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(FIXTURE_NOW_ISO));
    useAppStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('寫入失敗：saveError 是 SAVE_FAILED，診斷文字在 detail；成功後清除', async () => {
    const { backend } = buildWorkspaceFixture();
    useAppStore.getState().hydrate(await loadWorkspace(backend), 'fixture');
    let failing = true;
    const writes = backend.write;
    backend.write = async (path, contents) => {
      if (failing) throw new Error('disk full');
      await writes(path, contents);
    };
    const sync = startPersistenceSync(backend);

    useAppStore.getState().createEventFromTemplate('coding', new Date('2026-11-02T15:30:00.000Z'));
    await sync.flush();
    expect(useAppStore.getState().saveError).toEqual({ code: 'SAVE_FAILED', detail: 'Error: disk full' });

    failing = false;
    await sync.flush();
    expect(useAppStore.getState().saveError).toBeNull();
    await sync.stop();
  });
});
