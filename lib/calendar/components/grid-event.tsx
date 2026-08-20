"use client"

import { EventDetailDialog } from "@/components/calendar/event-detail-dialog"
import { cn } from "@/lib/util/utils"
import { memo, useState } from "react"
import type { CalendarEvent, GridEventPosition } from "../types"
import { formatTime } from "../util/date"
import { eventTint } from "../util/event-style"

type GridEventProps = {
  position: GridEventPosition
  locale: string
  onEventClick?: (event: CalendarEvent) => void
}

export const GridEvent = memo(function GridEvent({
  position,
  locale,
  onEventClick,
}: GridEventProps) {
  const { event, top, height, width, left, zIndex } = position
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        tabIndex={0}
        style={{
          ...eventTint(event.color),
          top,
          height,
          width: `${width}%`,
          left: `${left}%`,
          zIndex,
        }}
        onClick={() => {
          setOpen(true)
          onEventClick?.(event)
        }}
        className={cn(
          "absolute flex flex-col overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left",
          event.color
            ? "border-l-2"
            : "border-l-2 border-l-primary/70 bg-primary/10",
          "cursor-pointer hover:opacity-80"
        )}
      >
        <span className="truncate text-xs leading-tight font-medium">
          {event.title}
        </span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground tabular-nums">
          {formatTime(event.start, locale)}
          {event.end.getTime() > event.start.getTime() &&
            ` – ${formatTime(event.end, locale)}`}
        </span>
      </button>
      {open && (
        <EventDetailDialog
          event={event}
          locale={locale}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
})
