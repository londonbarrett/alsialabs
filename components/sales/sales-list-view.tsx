"use client"

import { Dialog } from "@/components/common/dialog"
import { PageHeader } from "@/components/common/page-header"
import { InvoiceForm } from "@/components/sales/invoice-form"
import {
  MonthlyRevenueChart,
  type MonthlyRevenue,
} from "@/components/sales/monthly-revenue-chart"
import { PaymentHistoryContent } from "@/components/sales/payment-history-content"
import { RecordPaymentForm } from "@/components/sales/record-payment-form"
import { SalesActionMenu } from "@/components/sales/sales-action-menu"
import { StatusBadge } from "@/components/sales/status-badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Invoice } from "@/lib/drizzle/schema"
import { ChartNoAxesCombined, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface SalesListViewProps {
  invoices: Array<Invoice & { clientName: string | null }>
  permissions?: string[]
  monthlyRevenue?: MonthlyRevenue[]
  topClients?: TopClient[]
}

function getOutstanding(invoice: {
  grandTotal: string
  paidAmount?: string | null
}): string {
  const total = parseFloat(invoice.grandTotal) || 0
  const paid = parseFloat(invoice.paidAmount ?? "0") || 0
  return (total - paid).toFixed(2)
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

          <div
            className="max-h-[calc(100vh-10rem)] overflow-auto rounded-md border"
            role="region"
            aria-label={t("sales.title")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    {t("sales.invoiceHash")}
                  </TableHead>
                  <TableHead scope="col">{t("sales.client")}</TableHead>
                  <TableHead scope="col">{t("sales.type")}</TableHead>
                  <TableHead scope="col">{t("sales.date")}</TableHead>
                  <TableHead scope="col">
                    {t("sales.dueDate")}
                  </TableHead>
                  <TableHead scope="col">{t("sales.total")}</TableHead>
                  <TableHead scope="col">
                    {t("sales.outstanding")}
                  </TableHead>
                  <TableHead scope="col">{t("sales.status")}</TableHead>
                  <TableHead scope="col">
                    {t("sales.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const outstanding = getOutstanding(inv)
                  return (
                    <TableRow
                      key={inv.id}
                      className="select-none"
                      onDoubleClick={() =>
                        permissions.includes("sales:edit") &&
                        openEdit(inv)
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>{inv.clientName ?? "—"}</TableCell>
                      <TableCell className="capitalize">
                        {inv.type}
                      </TableCell>
                      <TableCell>{inv.issueDate}</TableCell>
                      <TableCell>{inv.dueDate ?? "—"}</TableCell>
                      <TableCell>
                        $
                        {parseFloat(inv.grandTotal).toLocaleString(
                          "en-US",
                          { minimumFractionDigits: 2 }
                        )}
                      </TableCell>
                      <TableCell>
                        {parseFloat(outstanding) > 0 ? (
                          <span className="font-mono">
                            $
                            {parseFloat(outstanding).toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2 }
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            $0.00
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell>
                        <SalesActionMenu
                          invoice={inv}
                          permissions={permissions}
                          onEdit={() => openEdit(inv)}
                          onViewPayments={() =>
                            setHistoryInvoice(inv as Invoice)
                          }
                          onRecordPayment={() =>
                            setPaymentInvoice(inv as Invoice)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
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
          <PaymentHistoryContent invoiceId={historyInvoice.id} />
        </Dialog>
      )}
    </>
  )
}
