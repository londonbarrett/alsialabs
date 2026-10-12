"use client"

import type { InvoiceWithClientNameDTO } from "@/actions/schemas/invoice"
import {
  createInvoiceStore,
  InvoiceStoreContext,
} from "@/stores/invoice/invoice-store"
import { useServerReseed } from "@/hooks/use-server-reseed"
import { useState } from "react"

export function InvoiceProvider({
  invoices,
  children,
}: {
  invoices: InvoiceWithClientNameDTO[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createInvoiceStore(invoices))
  useServerReseed(store, invoices)

  return (
    <InvoiceStoreContext value={store}>{children}</InvoiceStoreContext>
  )
}
