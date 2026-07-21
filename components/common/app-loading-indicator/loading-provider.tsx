"use client"

import { createContext, useCallback, useState } from "react"
import { LoadingBar } from "./loading-bar"

type LoadingContextValue = {
  isLoading: boolean
  showLoading: () => void
  hideLoading: () => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)

  const showLoading = useCallback(() => {
    setCount((c) => c + 1)
  }, [])

  const hideLoading = useCallback(() => {
    setCount((c) => Math.max(0, c - 1))
  }, [])

  return (
    <LoadingContext.Provider
      value={{ isLoading: count > 0, showLoading, hideLoading }}
    >
      <LoadingBar />
      {children}
    </LoadingContext.Provider>
  )
}

export { LoadingProvider, LoadingContext }
export type { LoadingContextValue }
