"use client"

import { useEffect } from "react"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"

function LoadingDispatcher() {
  const { start, stop } = useLoadingIndicator()

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return null
}

export { LoadingDispatcher }
