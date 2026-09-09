"use client"

import { InvoiceDialogs } from "@/components/sales/invoice-dialogs"
import { InvoiceFilters } from "@/components/sales/invoice-filters"
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
import { useInvoiceFilters } from "@/hooks/use-invoice-filters"
import type { Invoice } from "@/lib/drizzle/schema"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface InvoicesCardProps {
  invoices: InvoiceWithClientName[]
  permissions?: string[]
}

export function InvoicesCard({
  invoices: initialInvoices,
  permissions = [],
}: InvoicesCardProps) {
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<
    Invoice | undefined
  >()
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(
    null
  )
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | null>(
    null
  )

  const {
    invoices,
    handleInvoiceSubmit: handleInvoiceSubmitBase,
    handlePaymentSubmit: handlePaymentSubmitBase,
    handleDeleteInvoice,
    handleCancelInvoice,
    handleReopenInvoice,
    handleMarkSent,
  } = useInvoiceActions(initialInvoices)

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filteredInvoices,
    isFiltered,
    clearFilters,
  } = useInvoiceFilters(invoices)

  async function handleInvoiceSubmit(
    data: import("@/lib/schemas/invoice").InvoiceFormData,
    invoiceId?: string
  ) {
    const editing = editingInvoice
    // Close optimistically – matches tasks-card pattern and keeps UI snappy
    setEditingInvoice(undefined)
    setDialogOpen(false)
    const result = await handleInvoiceSubmitBase(data, invoiceId, editing)
    if (!result.success && result.fieldErrors) {
      // Re-open on validation error so fieldErrors can be shown (form stays mounted via InvoiceDialogs)
      setEditingInvoice(editing)
      setDialogOpen(true)
    }
    return result
  }

  async function handlePaymentSubmit(
    values: import("@/components/sales/payment-form").PaymentFormValues
  ) {
    const current = paymentInvoice
    // Close immediately – optimistic update already applied in hook
    setPaymentInvoice(null)
    const result = await handlePaymentSubmitBase(values, current)
    if (!result.success) {
      // Keep dialog closed, surface error via toast; user can re-open to retry
      // No re-open to avoid jarring flash – validation errors for payments are rare
    }
    return result
  }

  function openNew() {
    setEditingInvoice(undefined)
    setDialogOpen(true)
  }

  function openEdit(invoice: InvoiceWithClientName) {
    setEditingInvoice(invoice as Invoice)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingInvoice(undefined)
  }

  const canCreate = permissions.includes("sales:create")
  const canManagePayments =
    permissions.includes("sales:edit") ||
    permissions.includes("sales:create") ||
    permissions.includes("sales:delete")

  return (
    <>
      <Card className="overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t("sales.invoices")}</CardTitle>
          {canCreate && (
            <Button
              onClick={openNew}
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
                  onClick={openNew}
                  aria-label={t("sales.newInvoice")}
                >
                  <Plus />
                  {t("sales.newInvoice")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <InvoiceFilters
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                isFiltered={isFiltered}
                onClearFilters={clearFilters}
                resultCount={filteredInvoices.length}
              />
              {filteredInvoices.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t("common.noResults")}
                </p>
              ) : (
                <SalesInvoiceTable
                  invoices={filteredInvoices}
                  permissions={permissions}
                  onEdit={openEdit}
                  onViewPayments={(inv) =>
                    setHistoryInvoice(inv as Invoice)
                  }
                  onRecordPayment={(inv) =>
                    setPaymentInvoice(inv as Invoice)
                  }
                  onDelete={(inv) => handleDeleteInvoice(inv.id)}
                  onCancel={(inv) => handleCancelInvoice(inv.id)}
                  onReopen={(inv) => handleReopenInvoice(inv.id)}
                  onMarkSent={(inv) => handleMarkSent(inv.id)}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDialogs
        editingInvoice={editingInvoice}
        dialogOpen={dialogOpen}
        onDialogOpenChange={handleOpenChange}
        onInvoiceSubmit={handleInvoiceSubmit}
        paymentInvoice={paymentInvoice}
        onPaymentInvoiceChange={setPaymentInvoice}
        onPaymentSubmit={handlePaymentSubmit}
        historyInvoice={historyInvoice}
        onHistoryInvoiceChange={setHistoryInvoice}
        canManagePayments={canManagePayments}
      />
    </>
  )
}
