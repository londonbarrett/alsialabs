"use client"

import type { SettleResult } from "@/lib/types"
import { useActionError } from "@/lib/util/action-errors"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/**
 * The standard result every action produces: `{ data }` on success and
 * `{ serverError: { code } }` or `{ validationErrors }` on failure.
 */
export interface ActionResult {
  data?: unknown
  /**
   * Typed as `unknown` because `sessionAction` is not parameterized with a
   * `ServerError`, so actions built from it report `serverError: unknown`.
   * `settle` narrows it internally rather than forcing every caller to cast.
   */
  serverError?: unknown
  validationErrors?: unknown
}

/**
 * Toasts a mutation result and returns a `SettleResult`. Failure copy is
 * translated from the server error's code, falling back to `errorMessage` only
 * when a server error arrives without a code. `validationErrors` are returned
 * for the form to render and are intentionally not toasted.
 */
export function useSettle() {
  const t = useTranslations()
  const translateError = useActionError()

  return (
    result: ActionResult | undefined,
    successMessage: string,
    errorMessage?: string
  ): SettleResult => {
    const serverError = result?.serverError as
      | { code?: string }
      | null
      | undefined
    if (serverError) {
      const error = serverError.code
        ? translateError(serverError.code)
        : (errorMessage ?? t("common.somethingWentWrong"))
      toast.error(error)
      return { success: false, error }
    }
    if (result?.validationErrors) {
      return {
        success: false,
        fieldErrors: result.validationErrors as Record<
          string,
          string[] | undefined
        >,
      }
    }
    toast.success(successMessage)
    return { success: true }
  }
}
