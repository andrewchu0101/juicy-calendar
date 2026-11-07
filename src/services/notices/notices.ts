/**
 * Structured notices: the store keeps codes, never sentences. `detail` is a diagnostic for logs and
 * tests and is never shown on screen (AGENTS.md rule 11).
 *
 * Screen sentences come from the i18n dictionary (FR-09); this module only picks the key for a code.
 */
import type { Language } from '../../i18n/detectLanguage';
import { translate } from '../../i18n/i18n';
import type { ErrorCode } from '../persistence/backendError';
import type { WorkspaceIssue } from '../persistence/repository';
import { SCHEMA_VERSION } from '../persistence/schemas';

export type OpenErrorCode =
  | 'NO_WORKSPACE_JSON'
  | 'WORKSPACE_DAMAGED'
  | 'WORKSPACE_TOO_NEW'
  | 'WORKSPACE_LOCKED'
  | 'NOT_A_WORKSPACE'
  | 'PORTABLE_DATA_UNAVAILABLE'
  | 'OPEN_FAILED';

export type OpenErrorState = { code: OpenErrorCode; version?: number; detail?: string };

export type SaveErrorState = { code: 'SAVE_FAILED'; detail: string };

/** Rust 端錯誤代碼的畫面文字（FR-09）。目前沒有畫面直接顯示它們，但每個代碼兩種語言都有文字。 */
export function backendErrorText(language: Language, code: ErrorCode): string {
  switch (code) {
    case 'WORKSPACE_LOCKED':
      return translate(language, 'notice.open.workspaceLocked');
    case 'NOT_A_WORKSPACE':
      return translate(language, 'notice.open.notAWorkspace');
    case 'NO_WORKSPACE_OPEN':
      return translate(language, 'error.noWorkspaceOpen');
    case 'PATH_NOT_ALLOWED':
      return translate(language, 'error.pathNotAllowed');
    case 'IO_ERROR':
    case 'INVALID_FILE_ENCODING':
      return translate(language, 'error.ioError');
    case 'PORTABLE_DATA_UNAVAILABLE':
      return translate(language, 'notice.open.portableDataUnavailable');
  }
}

/** 開啟錯誤的畫面文字（FR-09、SDS UI-01）。`detail` 只給診斷，不顯示（AGENTS.md 規則 11）。 */
export function openErrorText(language: Language, error: OpenErrorState): string {
  switch (error.code) {
    case 'NO_WORKSPACE_JSON':
      return translate(language, 'notice.open.noWorkspaceJson');
    case 'WORKSPACE_DAMAGED':
      return translate(language, 'notice.open.workspaceDamaged');
    case 'WORKSPACE_TOO_NEW':
      return translate(language, 'notice.open.workspaceTooNew', { version: String(error.version), supported: SCHEMA_VERSION });
    case 'WORKSPACE_LOCKED':
      return translate(language, 'notice.open.workspaceLocked');
    case 'NOT_A_WORKSPACE':
      return translate(language, 'notice.open.notAWorkspace');
    case 'PORTABLE_DATA_UNAVAILABLE':
      return translate(language, 'notice.open.portableDataUnavailable');
    case 'OPEN_FAILED':
      return translate(language, 'notice.open.openFailed');
  }
}

/** 通知的畫面文字（FR-09、SDS UI-02）。`detail` 只給診斷，不顯示。 */
export function issueText(language: Language, issue: WorkspaceIssue): string {
  switch (issue.code) {
    case 'FILE_SKIPPED':
      return translate(language, 'notice.issue.fileSkipped', { file: issue.file });
    case 'SETTINGS_RESET':
      return translate(language, 'notice.issue.settingsReset');
  }
}

export function saveErrorText(language: Language, _error: SaveErrorState): string {
  return translate(language, 'notice.saveFailed');
}
