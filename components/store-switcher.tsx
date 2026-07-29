"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getUserStores, switchStore } from "@/lib/actions/stores"
import type { UserStore } from "@/lib/actions/stores"

interface StoreSwitcherProps {
  selectedStoreId: string | null
  role: string | null
}

export function StoreSwitcher({ selectedStoreId, role }: StoreSwitcherProps) {
  const t = useTranslations("store")
  const [stores, setStores] = useState<UserStore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getUserStores()
      setStores(result)
      setLoading(false)
    }
    load()
  }, [])

  const handleChange = useCallback(
    async (value: string) => {
      const storeId = value === "__all__" ? null : value
      await switchStore(storeId)
    },
    []
  )

  if (loading || stores.length === 0) return null
  if (role === "retailer" && stores.length <= 1) return null

  const value = selectedStoreId ?? "__all__"

  return (
    <Select value={value} onValueChange={handleChange}>
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
