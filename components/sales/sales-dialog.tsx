'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SalesForm } from '@/components/sales/sales-form'
import type { Invoice } from '@/lib/drizzle/schema'

interface SalesDialogProps {
  invoice?: Invoice
  clients: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SalesDialog({ invoice, clients, products, open, onOpenChange, onSuccess }: SalesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
          <DialogDescription>
            {invoice ? 'Update the invoice details below.' : 'Fill in the details to create a new invoice.'}
          </DialogDescription>
        </DialogHeader>
        <SalesForm
          invoice={invoice}
          clients={clients}
          products={products}
          onSuccess={() => {
            onSuccess()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
