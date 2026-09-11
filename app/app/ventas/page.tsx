import { Page } from "@/components/common/page"
import { PageHeader } from "@/components/common/page-header"
import { SalesView } from "@/components/sales/sales-view"
import { getInvoices } from "@/lib/actions/invoices"
import {
  getMonthlyRevenue,
  getTopClientsByRevenue,
} from "@/lib/actions/sales"
import { auth, getUserPermissions, hasPermission } from "@/lib/auth"
import { unwrapResponse } from "@/lib/util/unwrap"
import { ChartNoAxesCombined } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { forbidden } from "next/navigation"

export default async function SalesPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "sales", "view"))
  ) {
    forbidden()
  }

  const [
    invoicesResult,
    permissions,
    monthlyRevenueResult,
    topClientsResult,
  ] = await Promise.all([
    getInvoices(),
    getUserPermissions(session.user.id),
    getMonthlyRevenue(),
    getTopClientsByRevenue({ limit: 10 }),
  ])

  const invoices = unwrapResponse(invoicesResult)
  const monthlyRevenue = unwrapResponse(monthlyRevenueResult)
  const topClients = unwrapResponse(topClientsResult)
  const t = await getTranslations("sales")

  return (
    <Page
      header={
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          icon={ChartNoAxesCombined}
        />
      }
    >
      <SalesView
        invoices={invoices}
        permissions={permissions}
        monthlyRevenue={monthlyRevenue}
        topClients={topClients}
      />
    </Page>
  )
}
