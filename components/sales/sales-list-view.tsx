'use client'

import { useState } from 'react'
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
import { SalesDialog } from '@/components/sales/sales-dialog'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteInvoice } from '@/lib/actions/sales'
import type { Invoice } from '@/lib/drizzle/schema'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface SalesListViewProps {
  invoices: Array<Invoice & { clientName: string | null }>
  clients: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
  permissions?: string[]
}

export function SalesListView({ invoices, clients, products, permissions = [] }: SalesListViewProps) {
  const router = useRouter()
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
          <p className="text-muted-foreground">No invoices yet</p>
          {permissions.includes('sales:create') && (
            <Button onClick={openNew} aria-label="New invoice">
              <Plus />
              New Invoice
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
            {permissions.includes('sales:create') && (
              <Button onClick={openNew} aria-label="New invoice">
                <Plus />
                New Invoice
              </Button>
            )}
          </div>

          <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label="Invoices table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Invoice #</TableHead>
                  <TableHead scope="col">Client</TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col">Date</TableHead>
                  <TableHead scope="col">Total</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Actions</TableHead>
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
                          if (!result.success) toast.error(result.error || 'Failed to delete invoice')
                          else toast.success('Invoice deleted')
                        }}
                        canDelete={permissions.includes('sales:delete')}
                        onView={() => toast.info('Invoice: ' + inv.invoiceNumber)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <SalesDialog
        invoice={editingInvoice}
        clients={clients}
        products={products}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
