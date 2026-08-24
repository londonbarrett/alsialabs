import { useCallback, useMemo, useState } from "react"
import type { CalendarView } from "../types"
import { addDays, addMonths, addWeeks, startOfWeek } from "../util/date"

export interface UseCalendarOptions {
  initialView?: CalendarView
  initialDate?: Date
  weekStartsOn?: number
}

export function useCalendar({
  initialView = "month",
  initialDate,
  weekStartsOn = 0,
}: UseCalendarOptions = {}) {
  const [view, setView] = useState<CalendarView>(initialView)
  const [anchor, setAnchor] = useState<Date>(initialDate ?? new Date())

  const range = useMemo(() => {
    if (view === "day") {
      const start = addDays(anchor, 0)
      start.setHours(0, 0, 0, 0)
      const end = addDays(start, 1)
      return { start, end }
    }
    if (view === "week") {
      const start = startOfWeek(anchor, weekStartsOn)
      return { start, end: addWeeks(start, 1) }
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { start, end: addMonths(start, 1) }
  }, [view, anchor, weekStartsOn])

  const goToToday = useCallback(() => setAnchor(new Date()), [])
  const goToNext = useCallback(() => {
    setAnchor((current) => {
      if (view === "day") return addDays(current, 1)
      if (view === "week") return addWeeks(current, 1)
      return addMonths(current, 1)
    })
  }, [view])
  const goToPrev = useCallback(() => {
    setAnchor((current) => {
      if (view === "day") return addDays(current, -1)
      if (view === "week") return addWeeks(current, -1)
      return addMonths(current, -1)
    })
  }, [view])
  const changeView = useCallback((next: CalendarView) => {
    setView(next)
  }, [])

  return {
    view,
    anchor,
    range,
    setAnchor,
    goToToday,
    goToNext,
    goToPrev,
    changeView,
  }
}
