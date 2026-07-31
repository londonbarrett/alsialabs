"use client"

import { Dialog } from "@/components/common/dialog"
import { PageHeader } from "@/components/common/page-header"
import { InvoiceForm } from "@/components/sales/invoice-form"
import {
  MonthlyRevenueChart,
  type MonthlyRevenue,
} from "@/components/sales/monthly-revenue-chart"
import { PaymentHistory } from "@/components/sales/payment-history"
import { RecordPaymentForm } from "@/components/sales/record-payment-form"
import {
  getOutstanding,
  SalesInvoiceTable,
  type InvoiceWithClientName,
} from "@/components/sales/sales-invoice-table"
import {
  TopClientsChart,
  type TopClient,
} from "@/components/sales/top-clients-chart"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Invoice, InvoiceStatus } from "@/lib/drizzle/schema"
import { ChartNoAxesCombined, Plus, Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

interface SalesListViewProps {
  invoices: InvoiceWithClientName[]
  permissions?: string[]
  monthlyRevenue?: MonthlyRevenue[]
  topClients?: TopClient[]
}

const invoiceStatuses: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]

export function SalesListView({
  invoices,
  permissions = [],
  monthlyRevenue = [],
  topClients = [],
}: SalesListViewProps) {
  const router = useRouter()
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
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (
        query &&
        !inv.invoiceNumber.toLowerCase().includes(query) &&
        !(inv.clientName ?? "").toLowerCase().includes(query)
      ) {
        return false
      }
      if (statusFilter !== "all" && inv.status !== statusFilter) {
        return false
      }
      if (dateFrom && inv.issueDate < dateFrom) return false
      if (dateTo && inv.issueDate > dateTo) return false
      return true
    })
  }, [invoices, searchQuery, statusFilter, dateFrom, dateTo])

  const isFiltered =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== ""

  function clearFilters() {
    setSearchQuery("")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  function handleSuccess() {
    router.refresh()
    setEditingInvoice(undefined)
    setDialogOpen(false)
  }

  function openNew() {
    setEditingInvoice(undefined)
    setDialogOpen(true)
  }

  function openEdit(invoice: (typeof invoices)[number]) {
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
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">
            {t("sales.noInvoices")}
          </p>
          {permissions.includes("sales:create") && (
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
        <div className="flex flex-1 flex-col gap-6 p-6">
          <PageHeader
            title={t("sales.title")}
            subtitle={t("sales.subtitle")}
            icon={ChartNoAxesCombined}
          >
            {permissions.includes("sales:create") && (
              <Button
                onClick={openNew}
                aria-label={t("sales.newInvoice")}
              >
                <Plus />
                {t("sales.newInvoice")}
              </Button>
            )}
          </PageHeader>

          {(monthlyRevenue.length > 0 || topClients.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("activity.monthlyRevenue")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyRevenueChart data={monthlyRevenue} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("activity.topClients")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TopClientsChart data={topClients} />
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>{t("sales.invoices")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-end gap-3">
                  <p
                    className="mr-auto self-center text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {t("sales.resultCount", {
                      count: filteredInvoices.length,
                    })}
                  </p>
                  {isFiltered && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      aria-label={t("sales.clearFilters")}
                    >
                      <X />
                      {t("sales.clearFilters")}
                    </Button>
                  )}
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="invoice-search"
                      className="text-xs text-muted-foreground"
                    >
                      {t("common.search")}
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="invoice-search"
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("common.search")}
                        className="w-64 pl-8"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="status-filter"
                      className="text-xs text-muted-foreground"
                    >
                      {t("sales.status")}
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger
                        id="status-filter"
                        className="w-44"
                        aria-label={t("sales.status")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("sales.allStatuses")}
                        </SelectItem>
                        {invoiceStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`sales.statuses.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="date-from"
                      className="text-xs text-muted-foreground"
                    >
                      {t("sales.dateFrom")}
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="date-to"
                      className="text-xs text-muted-foreground"
                    >
                      {t("sales.dateTo")}
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-40"
                    />
                  </div>
                </div>
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
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog
        title={
          editingInvoice
            ? t("sales.editInvoice")
            : t("sales.newInvoice")
        }
        description={
          editingInvoice
            ? t("sales.updateDetails")
            : t("sales.fillDetails")
        }
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        className="sm:max-w-2xl"
      >
        <InvoiceForm
          key={editingInvoice?.id ?? "new"}
          invoice={editingInvoice}
          onSuccess={handleSuccess}
          onCancel={() => setDialogOpen(false)}
        />
      </Dialog>
      {paymentInvoice && (
        <Dialog
          key={paymentInvoice.id}
          title={t("sales.recordPayment")}
          description={t("sales.recordPaymentDesc")}
          open={!!paymentInvoice}
          onOpenChange={() => setPaymentInvoice(null)}
        >
          <RecordPaymentForm
            invoiceId={paymentInvoice.id}
            remainingBalance={getOutstanding(paymentInvoice)}
            onSuccess={() => {
              setPaymentInvoice(null)
              router.refresh()
            }}
            onCancel={() => setPaymentInvoice(null)}
          />
        </Dialog>
      )}
      {historyInvoice && (
        <Dialog
          title={t("sales.paymentHistory")}
          description={t("sales.paymentHistoryDesc", {
            number: historyInvoice.invoiceNumber,
          })}
          open={!!historyInvoice}
          onOpenChange={() => setHistoryInvoice(null)}
        >
          <PaymentHistory
            invoiceId={historyInvoice.id}
            canManage={permissions.includes("sales:record-payment")}
          />
        </Dialog>
      )}
    </>
  )
}
