"use client"

import { SparklesIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export function AiSearchInput() {
  const t = useTranslations("common")

  return (
    <InputGroup className="h-12">
      <InputGroupInput
        type="search"
        placeholder={t("aiSearchPlaceholder")}
        aria-label={t("aiSearchPlaceholder")}
        className="py-3"
      />
      <InputGroupAddon align="inline-end">
        <SparklesIcon className="text-ring" />
      </InputGroupAddon>
    </InputGroup>
  )
}
