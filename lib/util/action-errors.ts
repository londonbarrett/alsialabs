"use client"

import { useTranslations } from "next-intl"

export function useActionError() {
  const t = useTranslations("errors")
  return (code: string): string => {
    return t(code) || code
  }
}
