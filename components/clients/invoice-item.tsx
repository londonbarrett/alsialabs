'use client'

import { useTranslations } from 'next-intl'
import { Receipt } from 'lucide-react'
import { ActionMenu } from '@/components/common/action-menu'
import { StatusBadge } from '@/components/sales/status-badge'
import type { Invoice } from '@/lib/drizzle/schema'

interface InvoiceItemProps {
  invoice: Invoice
  onEdit: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
}

export function InvoiceItem({ invoice, onEdit, onDelete, canEdit, canDelete }: InvoiceItemProps) {
  const t = useTranslations('invoiceItem')
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
          <span className="text-sm font-medium">{t('invoice')}</span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="text-sm mt-0.5">
          <span className="font-mono">{invoice.invoiceNumber}</span>
          {' — '}
          <span className="font-semibold">{t('currencyPrefix')}{total}</span>
          {' '}
          <StatusBadge status={invoice.status} />
        </p>
      </div>
      {canEdit || canDelete ? (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionMenu
            entityName={t('invoiceNumber', { number: invoice.invoiceNumber })}
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
