import { SalesListView } from "@/components/sales/sales-list-view"
import {
  getMonthlyRevenue,
  getTopClientsByRevenue,
} from "@/lib/actions/reports"
import { getInvoices } from "@/lib/actions/sales"
import { auth, getUserPermissions, hasPermission } from "@/lib/auth"
import { forbidden } from "next/navigation"

export default async function SalesPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "sales", "view"))
  ) {
    forbidden()
  }

  const [invoices, permissions, monthlyRevenue, topClients] =
    await Promise.all([
      getInvoices(),
      getUserPermissions(session.user.id),
      getMonthlyRevenue(),
      getTopClientsByRevenue(10),
    ])

  return (
    <SalesListView
      invoices={invoices}
      permissions={permissions}
      monthlyRevenue={monthlyRevenue}
      topClients={topClients}
    />
  )
}
