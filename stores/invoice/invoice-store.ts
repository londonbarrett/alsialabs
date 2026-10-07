import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { salesReducer } from "./sales-reducer"

export function createInvoiceStore(invoices: InvoiceWithClientName[]) {
  /**
   * `invoices` is the server's slice. `paymentsByInvoiceId` is fetched when
   * the payments sheet opens, so a reseed keeps it and the sheet does not
   * reload on every focus.
   */
  return createOptimisticStore({
    initialState: { invoices, paymentsByInvoiceId: {} },
    reducer: salesReducer,
    serverSlice: "invoices",
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
