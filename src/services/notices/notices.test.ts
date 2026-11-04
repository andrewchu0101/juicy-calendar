import { describe, expect, it } from 'vitest';
import { issueText, openErrorText, saveErrorText } from './notices';

// 預期值是票 007 開工前畫面上的英文句子（逐字），不是從實作複製。票 012 改由字典提供時這些句子要維持不變。
describe('通知文字對照表 (AC-02.2, SDS UI-01／UI-02)', () => {
  it.each([
    [{ code: 'NO_WORKSPACE_JSON' }, 'This folder has no workspace.json.'],
    [{ code: 'WORKSPACE_DAMAGED' }, 'workspace.json is damaged, so the workspace was not opened.'],
    [{ code: 'WORKSPACE_TOO_NEW', version: 3 }, 'This workspace uses format 3, newer than this app supports (2).'],
    [{ code: 'WORKSPACE_LOCKED' }, 'This workspace is already open in another window.'],
    [{ code: 'NOT_A_WORKSPACE' }, 'This folder is not a workspace: it has no workspace.json.'],
    [{ code: 'OPEN_FAILED', detail: 'C:/secret/path exploded' }, 'Could not open the workspace.'],
  ] as const)('開啟錯誤 %j 顯示既有英文句子，且不顯示 detail', (error, sentence) => {
    expect(openErrorText(error)).toBe(sentence);
  });

  it('通知與儲存錯誤顯示既有英文句子，且不顯示 detail', () => {
    expect(issueText({ code: 'FILE_SKIPPED', file: 'events/broken.json', detail: 'invalid JSON' })).toBe(
      'Skipped events/broken.json: not a valid file. It was left untouched.',
    );
    expect(issueText({ code: 'SETTINGS_RESET' })).toBe(
      'settings.json was damaged. Defaults are in use; the old file is saved as settings.corrupt.json.',
    );
    expect(saveErrorText({ code: 'SAVE_FAILED', detail: 'Error: disk full' })).toBe(
      'Changes could not be saved and will be retried.',
    );
  });
});
