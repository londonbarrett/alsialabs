import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import {
  salesReducer,
  type SalesAction,
  type SalesState,
} from "./sales-reducer"

export function createInvoiceStore(invoices: InvoiceWithClientName[]) {
  return createOptimisticStore<SalesState, SalesAction>(
    { invoices, paymentsByInvoiceId: {} },
    salesReducer
  )
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
