import { ActivityView } from "@/components/activity/activity-view"
import { getActiveReminders } from "@/lib/actions/reminders"
import { auth, hasPermission } from "@/lib/auth"
import { forbidden } from "next/navigation"

export default async function ActivityPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "activity", "view"))
  ) {
    forbidden()
  }

  const activeReminders = await getActiveReminders()

  return <ActivityView activeReminders={activeReminders} />
}
