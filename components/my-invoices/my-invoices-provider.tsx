"use client"

import type { MyInvoicesResultDTO } from "@/actions/schemas/invoice"
import { useServerReseed } from "@/hooks/use-server-reseed"
import {
  createMyInvoicesStore,
  MyInvoicesStoreContext,
} from "@/stores/my-invoices/my-invoices-store"
import { useState } from "react"

export function MyInvoicesProvider({
  seed,
  children,
}: {
  seed: MyInvoicesResultDTO
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
