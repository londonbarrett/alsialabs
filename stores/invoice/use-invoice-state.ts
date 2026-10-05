"use client"

import { useInvoiceStore } from "./invoice-store"
import type { SalesAction, SalesState } from "./sales-reducer"
import type { OptimisticStore } from "@/lib/optimistic-store"

type StoreType = OptimisticStore<SalesState, SalesAction>

export function useInvoiceState() {
  const store = useInvoiceStore()
  const invoices = store((s: StoreType) => s.optimistic.invoices)
  const paymentsByInvoiceId = store(
    (s: StoreType) => s.optimistic.paymentsByInvoiceId
  )
  const pending = store((s: StoreType) => s.pending)

  function getPayments(invoiceId: string) {
    return paymentsByInvoiceId[invoiceId]
  }

  return { invoices, paymentsByInvoiceId, pending, getPayments }
}
