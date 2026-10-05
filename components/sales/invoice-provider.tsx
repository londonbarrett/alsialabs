"use client"

import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import {
  createInvoiceStore,
  InvoiceStoreContext,
} from "@/stores/invoice/invoice-store"
import { useState } from "react"

export function InvoiceProvider({
  invoices,
  children,
}: {
  invoices: InvoiceWithClientName[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createInvoiceStore(invoices))

  return (
    <InvoiceStoreContext value={store}>{children}</InvoiceStoreContext>
  )
}
