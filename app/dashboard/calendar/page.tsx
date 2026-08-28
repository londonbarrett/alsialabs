import { CalendarView } from "@/components/calendar/calendar-view"
import { PageHeader } from "@/components/common/page-header"
import { getCalendarRoutines } from "@/lib/actions/calendar"
import { getMyTasks } from "@/lib/actions/tasks"
import { auth, hasPermission } from "@/lib/auth"
import { unwrapArray } from "@/lib/util/unwrap"
import { CalendarDays } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { forbidden } from "next/navigation"
import { Suspense } from "react"

export default async function CalendarPage() {
  const session = await auth()
  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "projects", "view"))
  ) {
    forbidden()
  }

  const [t, locale] = await Promise.all([
    getTranslations("calendar"),
    getLocale(),
  ])

  const tasks = unwrapArray(await getMyTasks({}))
  const routines = await getCalendarRoutines()

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col gap-6 p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={CalendarDays}
      />
      <Suspense
        fallback={
          <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-muted" />
        }
      >
        <CalendarView
          tasks={tasks}
          routines={routines}
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
      </Suspense>
    </div>
  )
}
