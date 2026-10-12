import type { ActionErrorCode } from "@/actions/error-codes"
import { ActionError as ActionErrorCodes } from "@/actions/error-codes"

/**
 * The single result contract every action resolves to — next-safe-action's
 * shape, produced natively by `safe-action` actions and by `runAction` for the
 * plain server functions in `actions/not-safe`.
 *
 * - success: `{ data }`
 * - failure: `{ serverError: { code } }` or `{ validationErrors }`
 */
export type ServerError = { code: ActionErrorCode }

export type ActionFieldErrors = Record<string, string[] | undefined>

export type ActionResult<T> =
  | { data: T; serverError?: undefined; validationErrors?: undefined }
  | { data?: undefined; serverError: ServerError; validationErrors?: undefined }
  | {
      data?: undefined
      serverError?: undefined
      validationErrors: ActionFieldErrors
    }

/**
 * Thrown inside server actions to fail with a typed code, mirroring tRPC's
 * `TRPCError`. Caught by `handleServerError` (safe actions) or `runAction`
 * (plain server functions) and surfaced as `serverError: { code }`, never as a
 * translated string — translation happens on the client from the code.
 */
export class ActionError extends Error {
  readonly code: ActionErrorCode

  constructor(code: ActionErrorCode) {
    super(code)
    this.name = "ActionError"
    this.code = code
  }
}

/** Thrown to fail with field errors, surfaced as `validationErrors`. */
export class ActionValidationError extends Error {
  readonly fieldErrors: ActionFieldErrors

  constructor(fieldErrors: ActionFieldErrors) {
    super(ActionErrorCodes.VALIDATION_FAILED)
    this.name = "ActionValidationError"
    this.fieldErrors = fieldErrors
  }
}

export function throwActionError(code: ActionErrorCode): never {
  throw new ActionError(code)
}

export function throwActionValidationError(
  fieldErrors: ActionFieldErrors
): never {
  throw new ActionValidationError(fieldErrors)
}

export const isActionError = (error: unknown): error is ActionError =>
  error instanceof ActionError

export const isActionValidationError = (
  error: unknown
): error is ActionValidationError =>
  error instanceof ActionValidationError

/**
 * Runs a plain server function and normalises its outcome into the standard
 * `ActionResult`, so `actions/not-safe` endpoints return exactly what
 * next-safe-action actions do. Thrown `ActionError`s become `serverError`,
 * thrown `ActionValidationError`s become `validationErrors`, and anything
 * unexpected becomes `INTERNAL_SERVER_ERROR`.
 */
export async function runAction<T>(
  fn: () => Promise<T> | T
): Promise<ActionResult<T>> {
  try {
    return { data: await fn() }
  } catch (error) {
    if (error instanceof ActionError) {
      return { serverError: { code: error.code } }
    }
    if (isActionValidationError(error)) {
      return { validationErrors: error.fieldErrors }
    }
    console.error(error)
    return { serverError: { code: ActionErrorCodes.INTERNAL_SERVER_ERROR } }
  }
}
