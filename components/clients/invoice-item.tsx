"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { TimelineInvoiceDialog } from "@/components/clients/timeline-invoice-dialog"
import { StatusBadge } from "@/components/sales/status-badge"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { deleteInvoice } from "@/lib/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useHasPermission } from "@/stores/permissions-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { Receipt } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface InvoiceItemProps {
  invoice: Invoice
  clientId: string
}

export function InvoiceItem({ invoice, clientId }: InvoiceItemProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const canEdit = useHasPermission("sales:edit")
  const canDelete = useHasPermission("sales:delete")
  const { run } = useOptimisticAction(useTimelineStore)
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: Invoice
  }>({ open: false })

  const [y, m, d] = invoice.issueDate.split("-")
  const date = `${m}/${d}/${y}`

  const total = parseFloat(invoice.grandTotal).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })

  async function handleDelete() {
    const result = await run(
      { type: "remove", kind: "invoice", id: invoice.id },
      () => deleteInvoice({ invoiceId: invoice.id }),
      { key: clientId }
    )
    if (result.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result.data) {
      toast.success(t("sales.invoiceDeleted"))
    } else {
      toast.error(t("sales.failedToDelete"))
    }
  }

  return (
    <>
      <div className="group flex items-start gap-3 py-3">
        <div className="mt-0.5 text-emerald-500">
          <Receipt className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("invoiceItem.invoice")}
            </span>
            <span className="text-xs text-muted-foreground">
              {date}
            </span>
          </div>
          <p className="mt-0.5 text-sm">
            <span className="font-mono">{invoice.invoiceNumber}</span>
            {" — "}
            <span className="font-semibold">
              {t("invoiceItem.currencyPrefix")}
              {total}
            </span>{" "}
            <StatusBadge status={invoice.status} />
          </p>
        </div>
        {canEdit || canDelete ? (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <ActionMenu
              entityName={t("invoiceItem.invoiceNumber", {
                number: invoice.invoiceNumber,
              })}
              onEdit={() => setDialog({ open: true, editing: invoice })}
              onDelete={handleDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        ) : null}
      </div>
      <TimelineInvoiceDialog
        clientId={clientId}
        open={dialog.open}
        onOpenChange={(o) =>
          setDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        editingInvoice={dialog.editing}
      />
    </>
  )
}
