"use client"

import { InvoiceFilters } from "@/components/sales/invoice-filters"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import { PaymentHistoryDialog } from "@/components/sales/payment-history-dialog"
import { SalesInvoiceDialog } from "@/components/sales/sales-invoice-dialog"
import { SalesInvoiceTable } from "@/components/sales/sales-invoice-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useInvoiceActions } from "@/stores/use-invoice-actions"
import { useInvoiceState } from "@/stores/use-invoice-state"
import { usePaymentActions } from "@/stores/use-payment-actions"
import type { Invoice } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function InvoicesCard() {
  const t = useTranslations()

  const {
    deleteInvoice,
    cancelInvoice,
    reopenInvoice,
    sendInvoice,
  } = useInvoiceActions()
  const { invoices } = useInvoiceState()
  const { recordPayment } = usePaymentActions()

  // Dialog state
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

  function handleRecordPaymentSubmit(values: PaymentFormValues) {
    const invoice = paymentDialog.invoice
    if (!invoice) return

    setPaymentDialog((s) => ({ ...s, open: false }))
    recordPayment(invoice, values)
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
