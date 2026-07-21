"use client"

import { useContext } from "react"
import { LoadingContext } from "@/components/loading-provider"

function useLoadingIndicator() {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error("useLoadingIndicator must be used within a LoadingProvider")
  }
  return {
    isLoading: context.isLoading,
    start: context.showLoading,
    stop: context.hideLoading,
  }
}

export { useLoadingIndicator }
