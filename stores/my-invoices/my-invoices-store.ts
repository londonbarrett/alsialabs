import type { MyInvoicesResultDTO } from "@/actions/schemas/invoice"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { myInvoicesReducer } from "./my-invoices-reducer"

export function createMyInvoicesStore(seed: MyInvoicesResultDTO) {
  /**
   * The seed is the whole state — `clientId` and `invoices` both come from
   * `getMyInvoices`, so a reseed replaces the state wholesale and no
   * `serverSlice` is declared.
   */
  return createOptimisticStore({
    initialState: seed,
    reducer: myInvoicesReducer,
  })
}

type MyInvoicesStore = ReturnType<typeof createMyInvoicesStore>

export const MyInvoicesStoreContext =
  createContext<MyInvoicesStore | null>(null)

export function useMyInvoicesStore(): MyInvoicesStore {
  const store = useContext(MyInvoicesStoreContext)
  if (!store) {
    throw new Error(
      "useMyInvoicesStore must be used within a MyInvoicesProvider"
    )
  }
  return store
}
