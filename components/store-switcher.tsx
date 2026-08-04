"use client"

import { ChevronsUpDown, Store } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
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
  const { isMobile } = useSidebar()
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

  const handleSwitch = useCallback(
    (storeId: string | null) => {
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

  const activeStore = stores.find((store) => store.id === selectedStoreId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={isPending}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Store className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeStore?.name ?? t("allStores")}
                </span>
                <span className="truncate text-xs">
                  {t("count", { count: stores.length })}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("switchStore")}
            </DropdownMenuLabel>
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => handleSwitch(store.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Store className="size-3.5 shrink-0" />
                </div>
                {store.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
