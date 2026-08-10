import { Suspense } from "react"
import { ActiveRemindersCard } from "@/components/activity/active-reminders-card"
import { InactiveClientsCard } from "@/components/activity/inactive-clients-card"
import { InactiveClientsCardFallback } from "@/components/activity/inactive-clients-card-fallback"
import { PageHeader } from "@/components/common/page-header"
import { getInactiveClients } from "@/lib/actions/activity"
import { getActiveReminders } from "@/lib/actions/reminders"
import { auth, hasPermission } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { BellRing } from "lucide-react"
import { forbidden } from "next/navigation"

const DEFAULT_INACTIVE_PERIOD = "30"

export default async function ActivityPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "activity", "view"))
  ) {
    forbidden()
  }

  const t = await getTranslations("activity")
  const activeReminders = await getActiveReminders()
  const inactiveClientsPromise = getInactiveClients(
    Number(DEFAULT_INACTIVE_PERIOD)
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={BellRing}
      />
      <ActiveRemindersCard reminders={activeReminders} />
      <Suspense
        fallback={
          <InactiveClientsCardFallback title={t("inactiveClients")} />
        }
      >
        <InactiveClientsCard
          initialClients={inactiveClientsPromise}
          defaultPeriod={DEFAULT_INACTIVE_PERIOD}
        />
      </Suspense>
    </div>
  )
}
