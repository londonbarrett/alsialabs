import { CalendarView } from "@/components/calendar/calendar-view"
import { PageHeader } from "@/components/common/page-header"
import { CalendarDays } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

export default async function CalendarPage() {
  const t = await getTranslations()

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col gap-6 p-6">
      <PageHeader
        title={t("nav.calendario")}
        subtitle={t("calendar.subtitle")}
        icon={CalendarDays}
      />
      <Suspense
        fallback={
          <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-muted" />
        }
      >
        <CalendarView
          labels={{
            today: t("calendar.today"),
            month: t("calendar.month"),
            week: t("calendar.week"),
            day: t("calendar.day"),
            moreEvents: t("calendar.moreEvents"),
            allDay: t("calendar.allDay"),
          }}
        />
      </Suspense>
    </div>
  )
}
