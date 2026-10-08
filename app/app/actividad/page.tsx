import { Suspense } from "react"
import { ActivityProvider } from "@/components/activity/activity-provider"
import { RemindersCard } from "@/components/activity/reminders-card"
import { InactiveClientsCard } from "@/components/activity/inactive-clients-card"
import { InactiveClientsCardFallback } from "@/components/activity/inactive-clients-card-fallback"
import { PageHeader } from "@/components/common/page-header"
import { getInactiveClients } from "@/actions/activity"
import { getReminders } from "@/actions/reminders"
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
  const reminders = await getReminders()
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
      <ActivityProvider reminders={reminders}>
        <RemindersCard />
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
      </ActivityProvider>
    </div>
  )
}
