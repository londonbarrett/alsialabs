'use client'

import { Receipt } from 'lucide-react'
import { ActionMenu } from '@/components/common/action-menu'
import type { Invoice } from '@/lib/drizzle/schema'

interface InvoiceItemProps {
  invoice: Invoice
  onEdit: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
}

export function InvoiceItem({ invoice, onEdit, onDelete, canEdit, canDelete }: InvoiceItemProps) {
  const [y, m, d] = invoice.issueDate.split('-')
  const date = `${m}/${d}/${y}`

  const total = parseFloat(invoice.grandTotal).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  })

  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className="mt-0.5 text-emerald-500">
        <Receipt className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Invoice</span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="text-sm mt-0.5">
          <span className="font-mono">{invoice.invoiceNumber}</span>
          {' — '}
          <span className="font-semibold">${total}</span>
          {' '}
          <span className={`text-xs capitalize px-1.5 py-0.5 rounded ${
            invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
            invoice.status === 'pending' ? 'bg-amber-100 text-amber-700' :
            invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {invoice.status}
          </span>
        </p>
      </div>
      {canEdit || canDelete ? (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionMenu
            entityName={`Invoice ${invoice.invoiceNumber}`}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      ) : null}
    </div>
  )
}
