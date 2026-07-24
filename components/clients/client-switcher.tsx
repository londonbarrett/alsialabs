"use client"

import { useTranslations } from "next-intl"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export function ClientSwitcher() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('clients')

  return (
    <div className="w-full max-w-sm">
      <ClientCombobox
        disabled={isPending}
        onValueChange={(id) => {
          if (id) {
            startTransition(() => {
              router.push(`/dashboard/clients/${id}`)
            })
          }
        }}
        placeholder={t('switchClient')}
      />
    </div>
  )
}
