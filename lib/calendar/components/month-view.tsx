"use client"

import { cn } from "@/lib/util/utils"
import { memo, useMemo } from "react"
import type { CalendarEvent, CalendarLabels } from "../types"
import {
  capitalize,
  endOfDay,
  getWeekdayLabels,
  isSameDay,
  isSameMonth,
  isToday,
  monthGrid,
  startOfDay,
} from "../util/date"
import { formatMoreEvents } from "../util/labels"
import { MonthEvent } from "./month-event"

type MonthViewProps = {
  anchor: Date
  events: CalendarEvent[]
  locale: string
  weekStartsOn: number
  maxMonthEvents?: number
  labels: CalendarLabels
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

export const MonthView = memo(function MonthView({
  anchor,
  events,
  locale,
  weekStartsOn,
  maxMonthEvents = 3,
  labels,
  onDateClick,
  onEventClick,
}: MonthViewProps) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const weeks = useMemo(
    () => monthGrid(year, month, weekStartsOn),
    [year, month, weekStartsOn]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const week of weeks) {
      for (const day of week) {
        const dayEvents = events
          .filter((event) => {
            if (event.allDay) return isSameDay(day, event.start)
            return (
              event.start.getTime() < endOfDay(day).getTime() &&
              event.end.getTime() > startOfDay(day).getTime()
            )
          })
          .sort((a, b) => {
            if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
            return a.start.getTime() - b.start.getTime()
          })
        map.set(day.toISOString(), dayEvents)
      }
    }
    return map
  }, [events, weeks])

  const dayEventsFor = (day: Date): CalendarEvent[] =>
    eventsByDay.get(day.toISOString()) ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/30">
        {getWeekdayLabels(locale, weekStartsOn, "long").map((label) => (
          <div
            key={label}
            className="border-r py-2 text-center text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {capitalize(label)}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y">
        {weeks.map((week, i) => (
          <div
            key={i}
            className="grid min-h-0 flex-1 grid-cols-7 divide-x"
          >
            {week.map((day) => {
              const inMonth = isSameMonth(day, anchor)
              const eventsOfDay = dayEventsFor(day)
              const visible = eventsOfDay.slice(0, maxMonthEvents)
              const overflow = eventsOfDay.length - visible.length

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex min-h-0 flex-col gap-0.5 overflow-hidden p-1",
                    inMonth
                      ? "bg-card"
                      : "bg-muted/30 text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onDateClick?.(day)}
                    className="flex size-6 shrink-0 items-center justify-center self-end rounded-full text-sm font-medium tabular-nums hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full",
                        isToday(day) &&
                          "border border-orange bg-orange/20 text-orange"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </button>

                  <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                    {visible.map((event) => (
                      <MonthEvent
                        key={event.id}
                        event={event}
                        locale={locale}
                        showTime
                        onEventClick={onEventClick}
                      />
                    ))}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => onDateClick?.(day)}
                        className="rounded-sm px-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {formatMoreEvents(labels.moreEvents, overflow)}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
})
