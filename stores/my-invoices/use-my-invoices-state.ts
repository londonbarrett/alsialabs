"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type {
  MyInvoicesAction,
  MyInvoicesState,
} from "./my-invoices-reducer"
import { useMyInvoicesStore } from "./my-invoices-store"

type StoreType = OptimisticStore<MyInvoicesState, MyInvoicesAction>

export function useMyInvoicesState() {
  const store = useMyInvoicesStore()
  const clientId = useStore(
    store,
    (s: StoreType) => s.optimistic.clientId
  )
  const invoices = useStore(
    store,
    (s: StoreType) => s.optimistic.invoices
  )
  const projects = useStore(
    store,
    (s: StoreType) => s.optimistic.projects
  )

  return { clientId, invoices, projects }
}
