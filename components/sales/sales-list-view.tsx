'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvoiceDialog } from '@/components/sales/invoice-dialog'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteInvoice } from '@/lib/actions/sales'
import type { Invoice } from '@/lib/drizzle/schema'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface SalesListViewProps {
  invoices: Array<Invoice & { clientName: string | null }>
  permissions?: string[]
}

export function SalesListView({ invoices, permissions = [] }: SalesListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>()

  function handleSuccess() {
    router.refresh()
    setEditingInvoice(undefined)
  }

  function openNew() {
    setEditingInvoice(undefined)
    setDialogOpen(true)
  }

  function openEdit(invoice: typeof invoices[number]) {
    setEditingInvoice(invoice as Invoice)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingInvoice(undefined)
  }

  return (
    <>
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">{t('sales.noInvoices')}</p>
          {permissions.includes('sales:create') && (
            <Button onClick={openNew} aria-label={t('sales.newInvoice')}>
              <Plus />
              {t('sales.newInvoice')}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{t('sales.title')}</h1>
            {permissions.includes('sales:create') && (
              <Button onClick={openNew} aria-label={t('sales.newInvoice')}>
                <Plus />
                {t('sales.newInvoice')}
              </Button>
            )}
          </div>

            <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label={t('sales.title')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('sales.invoiceHash')}</TableHead>
                  <TableHead scope="col">{t('sales.client')}</TableHead>
                  <TableHead scope="col">{t('sales.type')}</TableHead>
                  <TableHead scope="col">{t('sales.date')}</TableHead>
                  <TableHead scope="col">{t('sales.total')}</TableHead>
                  <TableHead scope="col">{t('sales.status')}</TableHead>
                  <TableHead scope="col">{t('sales.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="select-none" onDoubleClick={() => permissions.includes('sales:edit') && openEdit(inv)}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.clientName ?? '—'}</TableCell>
                    <TableCell className="capitalize">{inv.type}</TableCell>
                    <TableCell>{inv.issueDate}</TableCell>
                    <TableCell>${parseFloat(inv.grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="capitalize">{inv.status}</TableCell>
                    <TableCell>
                      <ActionMenu
                        entityName={`invoice ${inv.invoiceNumber}`}
                        onEdit={permissions.includes('sales:edit') ? () => openEdit(inv) : undefined}
                        onDelete={async () => {
                          const result = await deleteInvoice(inv.id)
                          if (!result.success) toast.error(result.error || t('sales.failedToDelete'))
                          else toast.success(t('sales.invoiceDeleted'))
                        }}
                        canDelete={permissions.includes('sales:delete')}
                        onView={() => toast.info(t('sales.invoicePrefix') + inv.invoiceNumber)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <InvoiceDialog
        invoice={editingInvoice}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
