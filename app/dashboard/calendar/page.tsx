import { Suspense } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import { forbidden } from "next/navigation"
import { PageHeader } from "@/components/common/page-header"
import { Calendar } from "@/lib/calendar"
import { getCalendarEvents } from "@/lib/actions/calendar"
import { auth, hasPermission } from "@/lib/auth"
import { CalendarDays } from "lucide-react"

export default function CalendarPage() {
  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col gap-6 p-6">
      <Suspense
        fallback={
          <div className="flex h-full animate-pulse rounded-xl bg-muted" />
        }
      >
        <CalendarContent />
      </Suspense>
    </div>
  )
}

async function CalendarContent() {
  const session = await auth()
  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "projects", "view"))
  ) {
    forbidden()
  }

  const [t, locale, events] = await Promise.all([
    getTranslations("calendar"),
    getLocale(),
    getCalendarEvents(),
  ])

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={CalendarDays}
      />
      <Calendar
        events={events}
        locale={locale}
        labels={{
          today: t("today"),
          month: t("month"),
          week: t("week"),
          day: t("day"),
          moreEvents: t("moreEvents"),
          allDay: t("allDay"),
        }}
      />
    </>
  )
}
