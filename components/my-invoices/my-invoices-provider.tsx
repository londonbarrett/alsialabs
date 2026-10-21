"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { MyInvoicesState } from "@/stores/my-invoices/my-invoices-reducer"
import {
  createMyInvoicesStore,
  MyInvoicesStoreContext,
} from "@/stores/my-invoices/my-invoices-store"
import { useState } from "react"

export function MyInvoicesProvider({
  seed,
  children,
}: {
  seed: MyInvoicesState
  children: React.ReactNode
}) {
  const [store] = useState(() => createMyInvoicesStore(seed))
  useServerReseed(store, seed)

  return (
    <MyInvoicesStoreContext value={store}>
      {children}
    </MyInvoicesStoreContext>
  )
}
