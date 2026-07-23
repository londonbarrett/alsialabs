import { ReportsView } from "@/components/reports/reports-view"
import { getActiveReminders } from "@/lib/actions/reminders"
import { auth, hasPermission } from "@/lib/auth"
import { forbidden } from "next/navigation"

export default async function ReportsPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "reports", "view"))
  ) {
    forbidden()
  }

  const activeReminders = await getActiveReminders()

  return <ReportsView activeReminders={activeReminders} />
}
