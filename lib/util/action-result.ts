/**
 * Whether a mutation result represents success.
 *
 * next-safe-action actions resolve to `{ data }` when they return a value and
 * to `{}` when they return nothing (a void mutation); failures resolve to
 * `{ serverError }` or `{ validationErrors }`. Store actions instead return an
 * explicit `{ success, error }` envelope.
 *
 * The only reliable failure signals are `serverError`/`validationErrors` (safe
 * actions) or `success === false` (store actions). Anything else that reached
 * this point did not throw, so it succeeded.
 */
export function defaultIsSuccess(result: unknown): boolean {
  if (result == null) return true
  const r = result as {
    success?: boolean
    serverError?: unknown
    validationErrors?: unknown
  }
  if (r.serverError !== undefined || r.validationErrors !== undefined)
    return false
  if (typeof r.success === "boolean") return r.success
  return true
}
