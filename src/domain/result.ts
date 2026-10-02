/**
 * Consistent result shape for every store mutation and guarded query.
 * Mirrors what a REST API would return: either `{ data }` or `{ error: { code, message } }`.
 */

export type ErrorCode =
  | 'FORBIDDEN' // 403 — current user may not see or mutate the resource
  | 'NOT_FOUND' // 404 — resource does not exist (or is archived)
  | 'VALIDATION' // 422 — payload failed validation
  | 'INVALID_PARENT' // 422 — hierarchy rule violated
  | 'CONFLICT'; // 409 — duplicate name or stale version

export interface AppError {
  code: ErrorCode;
  message: string;
  /** Optional per-field messages for forms. */
  fields?: Record<string, string>;
}

export type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ data });

export const fail = (code: ErrorCode, message: string, fields?: Record<string, string>): { error: AppError } => ({
  error: fields ? { code, message, fields } : { code, message },
});

export const isError = <T>(r: Result<T>): r is { error: AppError } => r.error !== undefined;
