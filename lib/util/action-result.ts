/**
 * Whether a mutation result represents success.
 *
 * Every action — next-safe-action actions and the plain server functions in
 * `actions/not-safe` normalised through `runAction` — resolves to the standard
 * result: `{ data }` on success, `{ serverError }` or `{ validationErrors }`
 * on failure. The only reliable failure signals are `serverError` and
 * `validationErrors`; anything else that reached this point did not throw, so
 * it succeeded.
 */
export function defaultIsSuccess(result: unknown): boolean {
  if (result == null) return true
  const r = result as {
    serverError?: unknown
    validationErrors?: unknown
  }
  return r.serverError === undefined && r.validationErrors === undefined
}
