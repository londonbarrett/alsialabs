import { auth, hasPermission } from "@/lib/auth"
import { forbidden } from "next/navigation"
import {
  getMonthlyRevenue,
  getTopClientsByRevenue,
} from "@/lib/actions/reports"
import { getActiveReminders } from "@/lib/actions/reminders"
import { ReportsView } from "@/components/reports/reports-view"

export default async function ReportsPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "reports", "view"))
  ) {
    forbidden()
  }

  const [monthlyRevenue, topClients, activeReminders] =
    await Promise.all([
      getMonthlyRevenue(),
      getTopClientsByRevenue(10),
      getActiveReminders(),
    ])

  return (
    <ReportsView
      monthlyRevenue={monthlyRevenue}
      topClients={topClients}
      activeReminders={activeReminders}
    />
  )
}
