import { z } from 'zod';
import { backendErrorText } from '../notices/notices';

const errorCodeSchema = z.enum(['WORKSPACE_LOCKED', 'NOT_A_WORKSPACE', 'NO_WORKSPACE_OPEN', 'PATH_NOT_ALLOWED', 'IO_ERROR']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const payloadSchema = z.object({ code: errorCodeSchema, detail: z.string().nullable().optional() });

/** An error from the backend. `detail` is for diagnostics only and must never reach the screen. */
export class BackendError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string | null,
  ) {
    super(backendErrorText(code));
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
