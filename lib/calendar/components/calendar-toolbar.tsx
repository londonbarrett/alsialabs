"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/util/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { CalendarView } from "../types"

const views: CalendarView[] = ["month", "week", "day"]

interface CalendarToolbarProps {
  title: string
  view: CalendarView
  labels: Record<"today" | "month" | "week" | "day", string>
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onViewChange: (view: CalendarView) => void
}

export const CalendarToolbar = memo(function CalendarToolbar({
  title,
  view,
  labels,
  onToday,
  onPrev,
  onNext,
  onViewChange,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onToday}>
          {labels.today}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrev}
          aria-label="Previous"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNext}
          aria-label="Next"
        >
          <ChevronRight />
        </Button>
      </div>

      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
        {title}
      </h2>

      <div
        role="group"
        aria-label="View"
        className="flex items-center rounded-md border bg-muted/50 p-0.5"
      >
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            aria-pressed={view === v}
            className={cn(
              "rounded-[min(var(--radius-md),6px)] px-2.5 py-1 text-sm font-medium capitalize transition-colors",
              view === v
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {labels[v]}
          </button>
        ))}
      </div>
    </div>
  )
})
