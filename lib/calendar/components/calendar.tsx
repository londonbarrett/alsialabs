"use client"

import { memo, useMemo } from "react"
import { cn } from "@/lib/util/utils"
import { useCalendar } from "../hooks/use-calendar"
import type { CalendarProps } from "../types"
import {
  capitalize,
  getDayLabel,
  getFirstDayOfWeek,
  getMonthLabel,
  getWeekLabel,
} from "../util/date"
import { resolveLabels } from "../util/labels"
import { CalendarToolbar } from "./calendar-toolbar"
import { GridView } from "./grid-view"
import { MonthView } from "./month-view"

export const Calendar = memo(function Calendar({
  events,
  initialView = "month",
  initialDate,
  locale = "en-US",
  weekStartsOn = getFirstDayOfWeek(locale),
  hourHeight = 64,
  startHour = 8,
  maxMonthEvents = 3,
  labels,
  onDateClick,
  onEventClick,
  className,
}: CalendarProps) {
  const resolvedLabels = useMemo(() => resolveLabels(labels), [labels])

  const calendar = useCalendar({
    initialView,
    initialDate,
    weekStartsOn,
  })
  const { view, anchor, range } = calendar

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(range.start)
        date.setDate(date.getDate() + i)
        return date
      }),
    [range.start]
  )

  const gridDays = useMemo(
    () => (view === "week" ? weekDays : [anchor]),
    [view, weekDays, anchor]
  )

  const title = useMemo(
    () =>
      capitalize(
        view === "month"
          ? getMonthLabel(anchor, locale)
          : view === "week"
            ? getWeekLabel(range.start, weekDays[6], locale)
            : getDayLabel(anchor, locale)
      ),
    [view, anchor, locale, range.start, weekDays]
  )

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}
    >
      <CalendarToolbar
        title={title}
        view={view}
        labels={resolvedLabels}
        onToday={calendar.goToToday}
        onPrev={calendar.goToPrev}
        onNext={calendar.goToNext}
        onViewChange={calendar.changeView}
      />

      {view === "month" && (
        <MonthView
          anchor={anchor}
          events={events}
          locale={locale}
          weekStartsOn={weekStartsOn}
          maxMonthEvents={maxMonthEvents}
          labels={resolvedLabels}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      )}
      {(view === "week" || view === "day") && (
        <GridView
          days={gridDays}
          events={events}
          locale={locale}
          labels={resolvedLabels}
          hourHeight={hourHeight}
          startHour={startHour}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      )}
    </div>
  )
})
