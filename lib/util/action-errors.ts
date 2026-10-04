"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"

export function useActionError() {
  const t = useTranslations("errors")
  return useCallback(
    (code: string): string => {
      return t(code) || code
    },
    [t]
  )
}
