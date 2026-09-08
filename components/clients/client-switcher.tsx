"use client"

import { ClientCombobox } from "@/components/clients/client-combobox"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export function ClientSwitcher() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations("clients")

  return (
    <div className="w-full max-w-sm">
      <ClientCombobox
        disabled={isPending}
        onValueChange={(client) => {
          if (client?.id) {
            startTransition(() => {
              router.push(`/dashboard/clients/${client.id}`)
            })
          }
        }}
        placeholder={t("switchClient")}
      />
    </div>
  )
}
