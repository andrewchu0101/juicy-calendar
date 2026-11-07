import { z } from 'zod';

const errorCodeSchema = z.enum(['WORKSPACE_LOCKED', 'NOT_A_WORKSPACE', 'NO_WORKSPACE_OPEN', 'PATH_NOT_ALLOWED', 'IO_ERROR', 'INVALID_FILE_ENCODING', 'PORTABLE_DATA_UNAVAILABLE']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const payloadSchema = z.object({ code: errorCodeSchema, detail: z.string().nullable().optional() });

/**
 * An error from the backend. `message` is the bare code and `detail` is for diagnostics only; neither
 * reaches the screen. Screen text comes from the dictionary by code (AGENTS.md rule 11, FR-09).
 */
export class BackendError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string | null,
  ) {
    super(code);
    this.name = 'BackendError';
  }

  /** Keeps `String(error)` the bare code, never the detail. */
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
