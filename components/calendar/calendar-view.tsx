"use client"

import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { getCalendarTasks } from "@/lib/actions/calendar"
import type {
  CalendarLabels,
  CalendarVisibleRange,
} from "@/lib/calendar"
import { Calendar } from "@/lib/calendar"
import { paddedRange } from "@/lib/calendar/util/date"
import { buildCalendarEvents } from "@/lib/calendar/util/events"
import type { CalendarRoutineData, CalendarTaskData } from "@/lib/types"
import { toDateKey } from "@/lib/util/schedule"
import { use, useCallback, useMemo, useRef, useState } from "react"

export interface CalendarViewProps {
  tasks: Promise<CalendarTaskData[]>
  routines: Promise<CalendarRoutineData[]>
  locale: string
  labels: Partial<CalendarLabels>
}

export function CalendarView({
  tasks,
  routines,
  locale,
  labels,
}: CalendarViewProps) {
  const initialTasks = use(tasks)
  const routineRows = use(routines)
  const [tasksState, setTasks] = useState(initialTasks)
  const [isFetching, setIsFetching] = useState(false)
  // Start with a wide window so the first paint has data; the first
  // visible-range callback narrows it to what is actually rendered.
  const [range, setRange] = useState(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - 90)
    const to = new Date()
    to.setDate(to.getDate() + 91)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  })
  const lastRangeKey = useRef<string | null>(null)
  const requestId = useRef(0)
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()

  const handleVisibleRangeChange = useCallback(
    (visible: CalendarVisibleRange) => {
      const padded = paddedRange(visible)
      setRange((current) =>
        current.from.getTime() === padded.from.getTime() &&
        current.to.getTime() === padded.to.getTime()
          ? current
          : padded
      )

      const key = `${toDateKey(padded.from)}|${toDateKey(padded.to)}`
      if (key === lastRangeKey.current) return
      const isFirstFetch = lastRangeKey.current === null
      lastRangeKey.current = key
      // Stale tasks from another range would be misleading while loading.
      if (!isFirstFetch) setTasks([])
      const id = ++requestId.current
      startLoading()
      setIsFetching(true)
      getCalendarTasks({
        from: toDateKey(padded.from),
        to: toDateKey(padded.to),
      })
        .then((next) => {
          if (requestId.current !== id) return
          setTasks(next)
        })
        .catch(() => {})
        .finally(() => {
          stopLoading()
          if (requestId.current === id) setIsFetching(false)
        })
    },
    [startLoading, stopLoading]
  )

  const events = useMemo(
    () =>
      buildCalendarEvents(
        tasksState,
        routineRows,
        range.from,
        range.to
      ),
    [tasksState, routineRows, range]
  )

  return (
    <Calendar
      events={events}
      isPending={isFetching}
      locale={locale}
      labels={labels}
      onVisibleRangeChange={handleVisibleRangeChange}
    />
  )
}
