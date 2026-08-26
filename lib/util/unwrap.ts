type SafeActionResult<T> = { data?: T; serverError?: unknown; validationErrors?: unknown }

export function unwrap<T>(result: SafeActionResult<T>, fallback: T): T {
  return result.data ?? fallback
}

export function unwrapArray<T>(result: SafeActionResult<T[]>): T[] {
  return result.data ?? []
}
