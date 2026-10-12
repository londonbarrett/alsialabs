/**
 * Extracts the payload from a next-safe-action result for server components,
 * falling back to `[]` (or the provided fallback) when the action returned no
 * data. Kept as the single place that narrows a possibly-absent `data` field;
 * call sites stay cast-free.
 */
type SafeActionResult<T> = {
  data?: T
  serverError?: unknown
  validationErrors?: unknown
}

export function unwrapResponse<T>(result: SafeActionResult<T[]>): T[]

export function unwrapResponse<T>(result: SafeActionResult<T>): T

export function unwrapResponse<T>(
  result: SafeActionResult<T>,
  fallback: T
): T

export function unwrapResponse<T>(
  result: SafeActionResult<T>,
  fallback?: T
): T | T[] {
  if (result.data !== undefined) return result.data as T | T[]
  if (fallback !== undefined) return fallback as T | T[]
  return [] as T
}
