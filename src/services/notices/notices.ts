/**
 * Structured notices: the store keeps codes, never sentences. `detail` is a diagnostic for logs and
 * tests and is never shown on screen (AGENTS.md rule 11).
 *
 * TEMPORARY: the English sentences below are the single table that ticket 012 replaces with the
 * i18n dictionary. Keep every screen sentence here and nowhere else.
 */
import type { ErrorCode } from '../persistence/backendError';
import type { WorkspaceIssue } from '../persistence/repository';
import { SCHEMA_VERSION } from '../persistence/schemas';

export type OpenErrorCode =
  | 'NO_WORKSPACE_JSON'
  | 'WORKSPACE_DAMAGED'
  | 'WORKSPACE_TOO_NEW'
  | 'WORKSPACE_LOCKED'
  | 'NOT_A_WORKSPACE'
  | 'OPEN_FAILED';

export type OpenErrorState = { code: OpenErrorCode; version?: number; detail?: string };

export type SaveErrorState = { code: 'SAVE_FAILED'; detail: string };

/** Sentences for errors raised by the Rust side. */
const BACKEND_TEXT: Record<ErrorCode, string> = {
  WORKSPACE_LOCKED: 'This workspace is already open in another window.',
  NOT_A_WORKSPACE: 'This folder is not a workspace: it has no workspace.json.',
  NO_WORKSPACE_OPEN: 'No workspace is open',
  PATH_NOT_ALLOWED: 'Path is not allowed',
  IO_ERROR: 'The file operation failed.',
};

export function backendErrorText(code: ErrorCode): string {
  return BACKEND_TEXT[code];
}

export function openErrorText(error: OpenErrorState): string {
  switch (error.code) {
    case 'NO_WORKSPACE_JSON':
      return 'This folder has no workspace.json.';
    case 'WORKSPACE_DAMAGED':
      return 'workspace.json is damaged, so the workspace was not opened.';
    case 'WORKSPACE_TOO_NEW':
      return `This workspace uses format ${error.version}, newer than this app supports (${SCHEMA_VERSION}).`;
    case 'WORKSPACE_LOCKED':
      return BACKEND_TEXT.WORKSPACE_LOCKED;
    case 'NOT_A_WORKSPACE':
      return BACKEND_TEXT.NOT_A_WORKSPACE;
    case 'OPEN_FAILED':
      return 'Could not open the workspace.';
  }
}

export function issueText(issue: WorkspaceIssue): string {
  switch (issue.code) {
    case 'FILE_SKIPPED':
      return `Skipped ${issue.file}: not a valid file. It was left untouched.`;
    case 'SETTINGS_RESET':
      return 'settings.json was damaged. Defaults are in use; the old file is saved as settings.corrupt.json.';
  }
}

export function saveErrorText(_error: SaveErrorState): string {
  return 'Changes could not be saved and will be retried.';
}
