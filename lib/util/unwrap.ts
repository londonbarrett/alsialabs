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
  if (Array.isArray((result as unknown as { data?: unknown }).data)) {
    return [] as unknown as T & T[]
  }
  throw new Error("Failed to unwrap SafeActionResult")
}
