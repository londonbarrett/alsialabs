"use client"

import { useTranslations } from "next-intl"
import { InvoiceForm } from "@/components/sales/invoice-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  products: InvoiceProductOption[]
  loading: boolean
}

type Action =
  | { type: "load" }
  | {
      type: "loaded"
      products: InvoiceProductOption[]
    }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { ...state, loading: true }
    case "loaded":
      return {
        products: action.products,
        loading: false,
      }
  }
}

const initialState: State = {
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
    getInvoiceProducts()
      .catch(() => [])
      .then((productsData) => {
        dispatch({
          type: "loaded",
          products: productsData,
        })
      })
  }, [open])

  const loading = open && state.loading
  const t = useTranslations()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? t('sales.editInvoice') : t('sales.newInvoice')}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? t('sales.updateDetails')
              : t('sales.fillDetails')}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : (
          <InvoiceForm
            invoice={invoice}
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
