import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { createOptimisticStore } from "@/lib/optimistic-store"
import {
  salesReducer,
  type SalesAction,
  type SalesState,
} from "@/stores/sales-reducer"
import { createContext, useContext } from "react"

export function createInvoiceStore(invoices: InvoiceWithClientName[]) {
  const store = createOptimisticStore<SalesState, SalesAction>(
    { invoices, paymentsByInvoiceId: {} },
    salesReducer
  )
  return Object.assign(store, {
    getInvoices: () => store((s) => s.optimistic.invoices),
    getPayments: (invoiceId: string) =>
      store((s) => s.optimistic.paymentsByInvoiceId[invoiceId]),
  })
}

type InvoiceStore = ReturnType<typeof createInvoiceStore>

export const InvoiceStoreContext = createContext<InvoiceStore | null>(
  null
)

export function useInvoiceStore(): InvoiceStore {
  const store = useContext(InvoiceStoreContext)
  if (!store) {
    throw new Error(
      "useInvoiceStore must be used within an InvoiceProvider"
    )
  }
  return store
}
