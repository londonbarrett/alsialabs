"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageHeader } from "@/components/common/page-header"
import { InvoiceDialog } from "@/components/sales/invoice-dialog"
import { ActionMenu } from "@/components/common/action-menu"
import { deleteInvoice } from "@/lib/actions/sales"
import {
  MonthlyRevenueChart,
  type MonthlyRevenue,
} from "@/components/reports/monthly-revenue-chart"
import {
  TopClientsChart,
  type TopClient,
} from "@/components/reports/top-clients-chart"
import type { Invoice } from "@/lib/drizzle/schema"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface SalesListViewProps {
  invoices: Array<Invoice & { clientName: string | null }>
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

  function handleSuccess() {
    router.refresh()
    setEditingInvoice(undefined)
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
            icon={FolderKanban}
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
                  <CardTitle>{t("reports.monthlyRevenue")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyRevenueChart data={monthlyRevenue} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("reports.topClients")}</CardTitle>
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
                  <TableHead scope="col">{t("sales.total")}</TableHead>
                  <TableHead scope="col">{t("sales.status")}</TableHead>
                  <TableHead scope="col">
                    {t("sales.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
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
                    <TableCell>
                      $
                      {parseFloat(inv.grandTotal).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {inv.status}
                    </TableCell>
                    <TableCell>
                      <ActionMenu
                        entityName={`invoice ${inv.invoiceNumber}`}
                        onEdit={
                          permissions.includes("sales:edit")
                            ? () => openEdit(inv)
                            : undefined
                        }
                        onDelete={async () => {
                          const result = await deleteInvoice(inv.id)
                          if (!result.success)
                            toast.error(
                              result.error || t("sales.failedToDelete")
                            )
                          else toast.success(t("sales.invoiceDeleted"))
                        }}
                        canDelete={permissions.includes("sales:delete")}
                        onView={() =>
                          toast.info(
                            t("sales.invoicePrefix") + inv.invoiceNumber
                          )
                        }
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
