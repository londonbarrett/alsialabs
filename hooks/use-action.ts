"use client"

import { useCallback, useTransition } from "react"
import { toast } from "sonner"

type ActionResult = { success: false; error?: string; fieldErrors?: Record<string, string[]> } | { success: true; data?: unknown }

export function useAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<ActionResult>,
  options?: {
    onSuccess?: (data: unknown) => void
    onError?: (error: string) => void
    successMessage?: string
  }
) {
  const [isPending, startTransition] = useTransition()

  const execute = useCallback(
    (...args: TArgs) => {
      startTransition(async () => {
        const result = await action(...args)

        if (!result.success) {
          const error = result.error || "Something went wrong"
          options?.onError?.(error)
          toast.error(error)
          return
        }

        if (options?.successMessage) {
          toast.success(options.successMessage)
        }
        options?.onSuccess?.(result.data)
      })
    },
    [action, options]
  )

  return { isPending, execute }
}
