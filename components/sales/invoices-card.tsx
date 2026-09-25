"use client"

import { InvoiceFilters } from "@/components/sales/invoice-filters"
import { PaymentHistoryDialog } from "@/components/sales/payment-history-dialog"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import type {
  PaymentFormValues,
  PaymentSubmitResult,
} from "@/components/sales/payment-form"
import { SalesInvoiceDialog } from "@/components/sales/sales-invoice-dialog"
import {
  SalesInvoiceTable,
  type InvoiceWithClientName,
} from "@/components/sales/sales-invoice-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useInvoiceActions } from "@/hooks/use-invoice-actions"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { recordPayment } from "@/lib/actions/payments"
import type { Invoice, InvoiceStatus } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useHasPermission } from "@/stores/permissions-store"
import { useInvoiceStore } from "@/stores/invoice-store"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface InvoicesCardProps {
  invoices: InvoiceWithClientName[]
}

export function InvoicesCard({
  invoices: initialInvoices,
}: InvoicesCardProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const { run: runInvoice } = useOptimisticAction(useInvoiceStore)

  const {
    invoices,
    deleteInvoice,
    cancelInvoice,
    reopenInvoice,
    sendInvoice,
  } = useInvoiceActions(initialInvoices)

  // Dialog state — owned by this parent
  const [invoiceDialog, setInvoiceDialog] = useState<{
    open: boolean
    editing?: Invoice
  }>({ open: false })
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean
    invoice?: Invoice
  }>({ open: false })
  const [historyDialog, setHistoryDialog] = useState<{
    open: boolean
    invoice?: Invoice
  }>({ open: false })

  const canCreate = useHasPermission("sales:create")

  async function handleRecordPaymentSubmit(
    values: PaymentFormValues
  ): Promise<PaymentSubmitResult> {
    const invoice = paymentDialog.invoice
    if (!invoice) {
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
      }
    }

    const currentPaid = parseFloat(invoice.paidAmount) || 0
    const added = parseFloat(values.amount) || 0
    const newPaid = currentPaid + added
    const grandTotal = parseFloat(invoice.grandTotal) || 0
    const newStatus: InvoiceStatus =
      newPaid >= grandTotal ? "paid" : "partially_paid"

    setPaymentDialog((s) => ({ ...s, open: false }))
    const result = await runInvoice(
      {
        type: "recordPayment",
        invoiceId: invoice.id,
        paidAmount: newPaid.toFixed(2),
        status: newStatus,
      },
      () => recordPayment({ invoiceId: invoice.id, ...values })
    )

    if (result?.data) {
      toast.success(t("sales.paymentRecorded"))
      return { success: true as const }
    }

    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      return {
        success: false as const,
        error: translateError(result.serverError.code),
      }
    }
    if (result?.validationErrors) {
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
        fieldErrors: result.validationErrors as Record<
          string,
          string[] | undefined
        >,
      }
    }
    toast.error(t("common.somethingWentWrong"))
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  return (
    <>
      <Card className="overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t("sales.invoices")}</CardTitle>
          {canCreate && (
            <Button
              onClick={() => setInvoiceDialog({ open: true })}
              aria-label={t("sales.newInvoice")}
            >
              <Plus />
              {t("sales.newInvoice")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <p className="text-muted-foreground">
                {t("sales.noInvoices")}
              </p>
              {canCreate && (
                <Button
                  onClick={() => setInvoiceDialog({ open: true })}
                  aria-label={t("sales.newInvoice")}
                >
                  <Plus />
                  {t("sales.newInvoice")}
                </Button>
              )}
            </div>
          ) : (
            <InvoiceFilters invoices={invoices}>
              {(filteredInvoices) =>
                filteredInvoices.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t("common.noResults")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <SalesInvoiceTable
                      invoices={filteredInvoices}
                      onEdit={(invoice) =>
                        setInvoiceDialog({
                          open: true,
                          editing: invoice,
                        })
                      }
                      onViewPayments={(invoice) =>
                        setHistoryDialog({
                          open: true,
                          invoice,
                        })
                      }
                      onRecordPayment={(invoice) =>
                        setPaymentDialog({
                          open: true,
                          invoice,
                        })
                      }
                      onDelete={(invoice) => deleteInvoice(invoice.id)}
                      onCancel={(invoice) => cancelInvoice(invoice.id)}
                      onReopen={(invoice) => reopenInvoice(invoice.id)}
                      onSend={(invoice) => sendInvoice(invoice.id)}
                    />
                  </div>
                )
              }
            </InvoiceFilters>
          )}
        </CardContent>
      </Card>

      <SalesInvoiceDialog
        open={invoiceDialog.open}
        onOpenChange={(o) =>
          setInvoiceDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        editingInvoice={invoiceDialog.editing}
      />
      <PaymentDialog
        open={paymentDialog.open}
        onOpenChange={(o) =>
          setPaymentDialog((s) => ({
            open: o,
            invoice: o ? s.invoice : undefined,
          }))
        }
        invoice={paymentDialog.invoice}
        onSubmit={handleRecordPaymentSubmit}
      />
      <PaymentHistoryDialog
        open={historyDialog.open}
        onOpenChange={(o) =>
          setHistoryDialog((s) => ({
            open: o,
            invoice: o ? s.invoice : undefined,
          }))
        }
        invoice={historyDialog.invoice}
      />
    </>
  )
}
