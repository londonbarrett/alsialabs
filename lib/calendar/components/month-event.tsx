import { cn } from "@/lib/util/utils"
import { memo } from "react"
import type { CalendarEvent } from "../types"
import { formatTime } from "../util/date"
import { eventDot, eventTint } from "../util/event-style"

type MonthEventProps = {
  event: CalendarEvent
  locale: string
  showTime?: boolean
  onEventClick?: (event: CalendarEvent) => void
}

export const MonthEvent = memo(function MonthEvent({
  event,
  locale,
  showTime = false,
  onEventClick,
}: MonthEventProps) {
  const isTimed =
    !event.allDay && event.start.getTime() !== event.end.getTime()

  return (
    <button
      type="button"
      tabIndex={0}
      style={eventTint(event.color)}
      onClick={() => onEventClick?.(event)}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-xs text-foreground",
        event.color
          ? "border-l-2"
          : "border-l-2 border-l-primary/70 bg-primary/10",
        !event.allDay && isTimed && "font-medium",
        onEventClick && "cursor-pointer hover:opacity-80",
        event.allDay && "border"
      )}
    >
      {event.allDay && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={eventDot(event.color)}
        />
      )}
      {showTime && isTimed && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatTime(event.start, locale)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </button>
  )
})
