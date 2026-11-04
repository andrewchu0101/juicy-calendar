import { z } from 'zod';

const errorCodeSchema = z.enum(['WORKSPACE_LOCKED', 'NOT_A_WORKSPACE', 'NO_WORKSPACE_OPEN', 'PATH_NOT_ALLOWED', 'IO_ERROR']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const payloadSchema = z.object({ code: errorCodeSchema, detail: z.string().nullable().optional() });

/**
 * Transitional screen text, equal to the sentences Rust used to send. Ticket 007 replaces it with
 * a central table and ticket 012 with the i18n dictionary; then `message` goes away.
 */
const LEGACY_MESSAGES: Record<ErrorCode, string> = {
  WORKSPACE_LOCKED: 'This workspace is already open in another window.',
  NOT_A_WORKSPACE: 'This folder is not a workspace: it has no workspace.json.',
  NO_WORKSPACE_OPEN: 'No workspace is open',
  PATH_NOT_ALLOWED: 'Path is not allowed',
  IO_ERROR: 'The file operation failed.',
};

/** An error from the backend. `detail` is for diagnostics only and must never reach the screen. */
export class BackendError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string | null,
  ) {
    super(LEGACY_MESSAGES[code]);
    this.name = 'BackendError';
  }

  /** The screens print `String(error)`; keep that the bare sentence, as it was for Rust strings. */
  override toString(): string {
    return this.message;
  }
}

export function toBackendError(raw: unknown): BackendError {
  const parsed = payloadSchema.safeParse(raw);
  if (parsed.success) return new BackendError(parsed.data.code, parsed.data.detail ?? null);
  const detail = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : null;
  return new BackendError('IO_ERROR', detail);
}
