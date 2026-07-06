"use client"

import { InvoiceForm } from "@/components/sales/invoice-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getClients, type ClientOption } from "@/lib/actions/clients"
import {
  getInvoiceProducts,
  type InvoiceProductOption,
} from "@/lib/actions/sales"
import type { Invoice } from "@/lib/drizzle/schema"
import { useEffect, useReducer } from "react"

interface InvoiceDialogProps {
  invoice?: Invoice
  selectedClientId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type State = {
  clients: ClientOption[]
  products: InvoiceProductOption[]
  loading: boolean
}

type Action =
  | { type: "load" }
  | {
      type: "loaded"
      clients: ClientOption[]
      products: InvoiceProductOption[]
    }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { ...state, loading: true }
    case "loaded":
      return {
        clients: action.clients,
        products: action.products,
        loading: false,
      }
  }
}

const initialState: State = {
  clients: [],
  products: [],
  loading: false,
}

export function InvoiceDialog({
  invoice,
  selectedClientId,
  open,
  onOpenChange,
  onSuccess,
}: InvoiceDialogProps) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!open) return
    dispatch({ type: "load" })
    Promise.all([
      getClients().catch(() => []),
      getInvoiceProducts().catch(() => []),
    ]).then(([clientsData, productsData]) => {
      dispatch({
        type: "loaded",
        clients: clientsData,
        products: productsData,
      })
    })
  }, [open])

  const loading = open && state.loading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? "Edit Invoice" : "New Invoice"}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? "Update the invoice details below."
              : "Fill in the details to create a new invoice."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <InvoiceForm
            invoice={invoice}
            clients={state.clients}
            products={state.products}
            selectedClientId={selectedClientId}
            onSuccess={() => {
              onSuccess()
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
