export type CalendarView = "month" | "week" | "day"

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  /** CSS color used to tint the event. Falls back to the brand color. */
  color?: string
  description?: string
}

export interface CalendarLabels {
  today: string
  month: string
  week: string
  day: string
  moreEvents: string
  allDay: string
}

export interface CalendarProps {
  events: CalendarEvent[]
  initialView?: CalendarView
  initialDate?: Date
  /** BCP-47 locale used for dates and weekday names. Defaults to "en-US". */
  locale?: string
  /** First day of the week: 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
  weekStartsOn?: number
  /** Pixel height of one hour in the time grid. Defaults to 64. */
  hourHeight?: number
  /** Hour the time grid is scrolled to by default (0-23). Defaults to 8. */
  startHour?: number
  /** Max event chips rendered per day in month view. Defaults to 3. */
  maxMonthEvents?: number
  labels?: Partial<CalendarLabels>
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  className?: string
}

export interface GridEventPosition {
  event: CalendarEvent
  /** Pixel offset from the top of the day column. */
  top: number
  /** Pixel height of the event block. */
  height: number
  /** Percentage width within the day column. */
  width: number
  /** Percentage left offset within the day column. */
  left: number
  zIndex: number
}
