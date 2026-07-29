"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type { UserStore } from "@/lib/actions/stores"
import { getUserStores, switchStore } from "@/lib/actions/stores"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"

interface StoreSwitcherProps {
  selectedStoreId: string | null
  role: string | null
}

export function StoreSwitcher({
  selectedStoreId,
  role,
}: StoreSwitcherProps) {
  const t = useTranslations("store")
  const router = useRouter()
  const [stores, setStores] = useState<UserStore[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()

  useEffect(() => {
    async function load() {
      const result = await getUserStores()
      setStores(result)
      setLoading(false)
    }
    load()
  }, [])

  const handleChange = useCallback(
    (value: string) => {
      const storeId = value === "__all__" ? null : value
      startLoading()
      startTransition(async () => {
        try {
          await switchStore(storeId)
          router.refresh()
        } finally {
          stopLoading()
        }
      })
    },
    [router, startLoading, stopLoading]
  )

  if (loading || stores.length === 0) return null
  if (role === "retailer" && stores.length <= 1) return null

  const value = selectedStoreId ?? "__all__"

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-7 w-auto min-w-32 text-xs">
        <SelectValue placeholder={t("selectStore")} />
      </SelectTrigger>
      <SelectContent>
        {role !== "retailer" && (
          <SelectItem value="__all__">{t("allStores")}</SelectItem>
        )}
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
