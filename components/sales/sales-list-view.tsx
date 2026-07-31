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
import type { Invoice } from "@/lib/drizzle/schema"
import { ChartNoAxesCombined, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface SalesListViewProps {
  invoices: InvoiceWithClientName[]
  permissions?: string[]
  monthlyRevenue?: MonthlyRevenue[]
  topClients?: TopClient[]
}

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

          <SalesInvoiceTable
            invoices={invoices}
            permissions={permissions}
            onEdit={openEdit}
            onViewPayments={(inv) => setHistoryInvoice(inv as Invoice)}
            onRecordPayment={(inv) => setPaymentInvoice(inv as Invoice)}
          />
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
