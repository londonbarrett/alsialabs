"use client"

import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"

export function useRefreshOnFocus() {
  const router = useRouter()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startTransition(() => router.refresh())
      }
    }

    window.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      window.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
  }, [router, startTransition])

  useEffect(() => {
    if (isPending) startLoading()
    else stopLoading()
  }, [isPending, startLoading, stopLoading])
}
