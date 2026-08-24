import type { CalendarLabels } from "../types"

export const defaultLabels: CalendarLabels = {
  today: "Today",
  month: "Month",
  week: "Week",
  day: "Day",
  moreEvents: "+{count} more",
  allDay: "All-day",
}

export function resolveLabels(
  labels: Partial<CalendarLabels> | undefined
): CalendarLabels {
  return { ...defaultLabels, ...labels }
}

export function formatMoreEvents(
  template: string,
  count: number
): string {
  return template.replace("{count}", String(count))
}
