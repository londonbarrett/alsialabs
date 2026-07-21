"use client"

import { useCallback, useTransition } from "react"
import { toast } from "sonner"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"

type ActionResult = { success: false; error?: string; fieldErrors?: Record<string, string[]> } | { success: true; data?: unknown }

export function useServerAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<ActionResult>,
  options?: {
    onSuccess?: (data: unknown) => void
    onError?: (error: string) => void
    successMessage?: string
  }
) {
  const [isPending, startTransition] = useTransition()
  const { start, stop } = useLoadingIndicator()

  const execute = useCallback(
    (...args: TArgs) => {
      start()
      startTransition(async () => {
        try {
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
        } finally {
          stop()
        }
      })
    },
    [action, options, start, stop]
  )

  return { isPending, execute }
}
