"use client"

import { cn } from "@/lib/util/utils"
import { memo, useEffect, useEffectEvent, useRef } from "react"
import type { CalendarEvent, CalendarLabels } from "../types"
import { endOfDay, formatHour, isToday, startOfDay } from "../util/date"
import { layoutDayEvents } from "../util/layout"
import { GridEvent } from "./grid-event"
import { GridHeader } from "./grid-header"
import { GridTimeIndicator } from "./grid-time-indicator"
import { MonthEvent } from "./month-event"

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const HOUR_LABEL_OVERFLOW = 12

type GridViewProps = {
  days: Date[]
  events: CalendarEvent[]
  locale: string
  labels: CalendarLabels
  hourHeight: number
  startHour?: number
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

export const GridView = memo(function GridView({
  days,
  events,
  locale,
  labels,
  hourHeight,
  startHour = 8,
  onDateClick,
  onEventClick,
}: GridViewProps) {
  const firstDay = startOfDay(days[0])
  const lastDay = endOfDay(days[days.length - 1])
  const dayHeight = 24 * hourHeight
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToStartHour = useEffectEvent(() => {
    scrollRef.current?.scrollTo({
      top: Math.max(startHour * hourHeight - HOUR_LABEL_OVERFLOW, 0),
    })
  })

  useEffect(() => {
    scrollToStartHour()
  }, [])

  const allDayEvents = (day: Date) =>
    events.filter(
      (event) =>
        event.allDay &&
        event.start.getTime() <= endOfDay(day).getTime() &&
        event.end.getTime() >= startOfDay(day).getTime()
    )

  const hasAllDay = events.some(
    (event) =>
      event.allDay &&
      event.start.getTime() < lastDay.getTime() &&
      event.end.getTime() > firstDay.getTime()
  )

  const todayIndex = days.findIndex((d) => isToday(d))
  const gridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <GridHeader
        days={days}
        locale={locale}
        onDateClick={onDateClick}
      />
      {hasAllDay && (
        <div className="flex shrink-0 border-b">
          <div className="flex w-14 shrink-0 items-start justify-end border-r px-2 pt-2 text-[11px] text-muted-foreground">
            {labels.allDay}
          </div>
          <div
            className="grid flex-1 divide-x"
            style={{ gridTemplateColumns }}
          >
            {days.map((day) => (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick?.(day)}
                className={cn(
                  "flex flex-col gap-0.5 p-1",
                  onDateClick && "cursor-pointer"
                )}
              >
                {allDayEvents(day).map((event) => (
                  <MonthEvent
                    key={event.id}
                    event={event}
                    locale={locale}
                    onEventClick={onEventClick}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 overflow-y-auto"
      >
        <div
          className="relative w-14 shrink-0 border-r"
          style={{ height: dayHeight }}
        >
          {HOURS.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
              style={{ top: hour * hourHeight }}
            >
              {formatHour(hour, locale)}
            </span>
          ))}
        </div>

        <div
          className="grid min-h-0 flex-1 divide-x"
          style={{ gridTemplateColumns }}
        >
          {days.map((day, col) => {
            const positions = layoutDayEvents(events, day, hourHeight)
            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick?.(day)}
                className={cn(
                  "relative",
                  onDateClick && "cursor-pointer",
                  isToday(day) && "bg-primary/5"
                )}
                style={{ height: dayHeight }}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: hour * hourHeight }}
                  />
                ))}

                {todayIndex === col && (
                  <GridTimeIndicator hourHeight={hourHeight} />
                )}

                {positions.map((position) => (
                  <GridEvent
                    key={position.event.id}
                    position={position}
                    locale={locale}
                    onEventClick={onEventClick}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
