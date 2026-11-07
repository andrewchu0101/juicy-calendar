import { describe, expect, it } from 'vitest';
import { backendErrorText, issueText, openErrorText, saveErrorText } from './notices';

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
    expect(openErrorText('en', error)).toBe(sentence);
  });

  it('通知與儲存錯誤顯示既有英文句子，且不顯示 detail', () => {
    expect(issueText('en', { code: 'FILE_SKIPPED', file: 'events/broken.json', detail: 'invalid JSON' })).toBe(
      'Skipped events/broken.json: not a valid file. It was left untouched.',
    );
    expect(issueText('en', { code: 'SETTINGS_RESET' })).toBe(
      'settings.json was damaged. Defaults are in use; the old file is saved as settings.corrupt.json.',
    );
    expect(saveErrorText('en', { code: 'SAVE_FAILED', detail: 'Error: disk full' })).toBe(
      'Changes could not be saved and will be retried.',
    );
  });
});

// TC-11｜FR-09、SDS UI-01、票 012：開啟錯誤的繁體中文。
// 只有 WORKSPACE_LOCKED 的句子是規格給定的原文（SDS UI-01）；其餘為我的提案翻譯，待專案擁有者審閱。
describe('開啟錯誤的繁體中文 (TC-11, FR-09, SDS UI-01)', () => {
  it.each([
    [{ code: 'WORKSPACE_LOCKED' }, '此工作區已在另一個視窗開啟，請先關閉那個視窗。'],
    [{ code: 'NO_WORKSPACE_JSON' }, '這個資料夾沒有 workspace.json。'],
    [{ code: 'WORKSPACE_DAMAGED' }, 'workspace.json 已損毀，所以沒有開啟這個工作區。'],
    [{ code: 'WORKSPACE_TOO_NEW', version: 3 }, '這個工作區使用格式 3，比本程式支援的格式（2）新。'],
    [{ code: 'NOT_A_WORKSPACE' }, '這個資料夾不是工作區：裡面沒有 workspace.json。'],
    [{ code: 'OPEN_FAILED', detail: 'C:/secret/path exploded' }, '無法開啟工作區。'],
  ] as const)('開啟錯誤 %j 以繁體中文顯示，且不顯示 detail', (error, sentence) => {
    expect(openErrorText('zh-TW', error)).toBe(sentence);
  });
});

// TC-11｜FR-09、SDS UI-02、票 012：通知與儲存錯誤的繁體中文（中文句子為提案翻譯，待審閱）。
describe('通知與儲存錯誤的繁體中文 (TC-11, FR-09, SDS UI-02)', () => {
  it('通知以繁體中文顯示，檔名保留原樣，且不顯示 detail', () => {
    expect(issueText('zh-TW', { code: 'FILE_SKIPPED', file: 'events/broken.json', detail: 'invalid JSON' })).toBe(
      '已略過 events/broken.json：不是有效的檔案，沒有動到它。',
    );
    expect(issueText('zh-TW', { code: 'SETTINGS_RESET' })).toBe(
      'settings.json 已損毀，改用預設值；舊檔另存為 settings.corrupt.json。',
    );
  });

  it('儲存錯誤以繁體中文顯示，且不顯示 detail', () => {
    expect(saveErrorText('zh-TW', { code: 'SAVE_FAILED', detail: 'Error: disk full' })).toBe('變更無法儲存，會再重試。');
  });
});

// TC-11｜FR-09、票 012 驗收條件 1：Rust 端的每個錯誤代碼，兩種語言都有文字。
// WORKSPACE_LOCKED 的中文是規格原句；英文維持票 007 之前畫面上的句子；其餘中文為提案翻譯。
describe('後端錯誤代碼的文字 (TC-11, FR-09)', () => {
  it.each([
    ['WORKSPACE_LOCKED', 'This workspace is already open in another window.', '此工作區已在另一個視窗開啟，請先關閉那個視窗。'],
    ['NOT_A_WORKSPACE', 'This folder is not a workspace: it has no workspace.json.', '這個資料夾不是工作區：裡面沒有 workspace.json。'],
    ['NO_WORKSPACE_OPEN', 'No workspace is open', '目前沒有開啟的工作區。'],
    ['PATH_NOT_ALLOWED', 'Path is not allowed', '不允許這個路徑。'],
    ['IO_ERROR', 'The file operation failed.', '檔案操作失敗。'],
    ['INVALID_FILE_ENCODING', 'The file operation failed.', '檔案操作失敗。'],
    [
      'PORTABLE_DATA_UNAVAILABLE',
      'The data folder next to the app could not be created or written to. Move the whole app folder somewhere writable and open it again.',
      '無法建立或寫入程式旁的 data 資料夾。請把整個程式資料夾移到可以寫入的位置，再重新開啟。',
    ],
  ] as const)('%s', (code, en, zh) => {
    expect(backendErrorText('en', code)).toBe(en);
    expect(backendErrorText('zh-TW', code)).toBe(zh);
  });
});


// TC-11｜FR-09、FR-11、ADR-05 條件①：免安裝版 data 無法建立或寫入時的明確錯誤（兩種語言；句子為提案，待審閱）。
describe('免安裝版 data 無法使用的開啟錯誤 (TC-11, FR-11)', () => {
  it('兩種語言都有文字，且不顯示 detail', () => {
    const error = { code: 'PORTABLE_DATA_UNAVAILABLE', detail: 'C:/secret/path denied' } as const;
    expect(openErrorText('en', error)).toBe(
      'The data folder next to the app could not be created or written to. Move the whole app folder somewhere writable and open it again.',
    );
    expect(openErrorText('zh-TW', error)).toBe(
      '無法建立或寫入程式旁的 data 資料夾。請把整個程式資料夾移到可以寫入的位置，再重新開啟。',
    );
  });
});
