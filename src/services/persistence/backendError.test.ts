import { describe, expect, it } from 'vitest';
import { BackendError, toBackendError } from './backendError';

describe('toBackendError', () => {
  // TC-08（代碼部分）、TC-10｜SDS 錯誤格式：Rust 的 {code, detail} 轉成帶代碼的錯誤。
  it.each(['WORKSPACE_LOCKED', 'NOT_A_WORKSPACE', 'NO_WORKSPACE_OPEN', 'PATH_NOT_ALLOWED', 'IO_ERROR'] as const)(
    'keeps the code and detail of a %s payload',
    (code) => {
      const error = toBackendError({ code, detail: 'diagnostic text' });
      expect(error).toBeInstanceOf(BackendError);
      expect(error.code).toBe(code);
      expect(error.detail).toBe('diagnostic text');
    },
  );

  // TC-10｜SDS：不符格式的錯誤（瀏覽器例外、舊式字串、未知代碼）一律視為 IO_ERROR，原文只留在 detail。
  it.each([
    ['a plain string', 'boom', 'boom'],
    ['an Error', new Error('network down'), 'network down'],
    ['an unknown code', { code: 'SOMETHING_NEW', detail: null }, null],
    ['null', null, null],
  ])('maps %s to IO_ERROR', (_label, raw, detail) => {
    const error = toBackendError(raw);
    expect(error.code).toBe('IO_ERROR');
    if (detail !== null) expect(error.detail).toBe(detail);
  });

  // 票 006 驗收：畫面文字暫時不變，且 detail 不直接顯示。String(error) 是現有畫面使用的形式。
  it.each([
    ['NOT_A_WORKSPACE', 'This folder is not a workspace: it has no workspace.json.'],
    ['NO_WORKSPACE_OPEN', 'No workspace is open'],
    ['PATH_NOT_ALLOWED', 'Path is not allowed'],
  ] as const)('shows the previous English sentence for %s and never the detail', (code, sentence) => {
    const error = toBackendError({ code, detail: 'C:/secret/path' });
    expect(error.message).toBe(sentence);
    expect(String(error)).toBe(sentence);
    expect(String(error)).not.toContain('secret');
  });
});
