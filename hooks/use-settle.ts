"use client"

import type { SettleResult } from "@/lib/types"
import { useActionError } from "@/lib/util/action-errors"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/**
 * The two result envelopes every mutation produces:
 * - next-safe-action actions: `{ data, serverError, validationErrors }`
 * - store actions (`upsertReminder`, ...): `{ success, error }`
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
  success?: boolean
  error?: string
}

/**
 * Standardises the `settle`/`settleToast`/`settleInvoice` helpers that were
 * duplicated across the action hooks: toasts the outcome and returns a
 * `SettleResult`. `validationErrors` are returned for the form to render and
 * are intentionally not toasted. `errorMessage` overrides the generic failure
 * copy for store actions that carry domain-specific wording.
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
      // Rendered as field errors by the form; no toast.
      return {
        success: false,
        error: errorMessage ?? t("common.somethingWentWrong"),
        fieldErrors: result.validationErrors as Record<
          string,
          string[] | undefined
        >,
      }
    }
    if (typeof result?.success === "boolean") {
      if (result.success) {
        toast.success(successMessage)
        return { success: true }
      }
      const error =
        result.error ?? errorMessage ?? t("common.somethingWentWrong")
      toast.error(error)
      return { success: false, error }
    }
    if (result?.data) {
      toast.success(successMessage)
      return { success: true }
    }
    const error = errorMessage ?? t("common.somethingWentWrong")
    toast.error(error)
    return { success: false, error }
  }
}
