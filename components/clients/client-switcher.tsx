"use client"

import { useTranslations } from "next-intl"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface ClientSwitcherProps {
  currentClientId: string
}

export function ClientSwitcher({ currentClientId }: ClientSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('clients')
  const [selectedId, setSelectedId] = useState(currentClientId)

  return (
    <div className="w-full max-w-sm">
      <ClientCombobox
        value={selectedId}
        disabled={isPending}
        onValueChange={(id) => {
          if (id) {
            setSelectedId(id)
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
