"use client"

import { getCalendarTasks } from "@/actions/not-safe/calendar"
import type {
  CalendarRoutineDataDTO,
  CalendarTaskDataDTO,
} from "@/actions/schemas/calendar"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type {
  CalendarLabels,
  CalendarVisibleRange,
} from "@/lib/calendar"
import { Calendar } from "@/lib/calendar"
import { paddedRange } from "@/lib/calendar/util/date"
import { buildCalendarEvents } from "@/lib/calendar/util/events"
import { toDateKey } from "@/lib/util/schedule"
import { useCallback, useMemo, useRef, useState } from "react"

export interface CalendarViewProps {
  tasks: CalendarTaskDataDTO[]
  routines: CalendarRoutineDataDTO[]
  labels: Partial<CalendarLabels>
}

export function CalendarView({
  tasks,
  routines,
  labels,
}: CalendarViewProps) {
  const [tasksState, setTasks] = useState(tasks)
  const routineRows = routines
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
    async (visible: CalendarVisibleRange) => {
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
      try {
        const result = await getCalendarTasks({
          from: toDateKey(padded.from),
          to: toDateKey(padded.to),
        })
        if (requestId.current !== id) return
        setTasks(result.data ?? [])
      } finally {
        stopLoading()
        if (requestId.current === id) setIsFetching(false)
      }
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
      labels={labels}
      onVisibleRangeChange={handleVisibleRangeChange}
    />
  )
}
