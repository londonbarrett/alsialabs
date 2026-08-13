import { memo } from "react"
import { cn } from "@/lib/util/utils"
import { capitalize, isToday } from "../util/date"

interface GridHeaderProps {
  days: Date[]
  locale: string
  onDateClick?: (date: Date) => void
}

export const GridHeader = memo(function GridHeader({
  days,
  locale,
  onDateClick,
}: GridHeaderProps) {
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
  })
  const gridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="flex shrink-0 border-b bg-muted/30">
      <div className="w-14 shrink-0 border-r" />
      <div className="grid flex-1" style={{ gridTemplateColumns }}>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            onClick={() => onDateClick?.(day)}
            className={cn(
              "flex items-center justify-center gap-1.5 border-r py-2 text-xs font-medium text-muted-foreground last:border-r-0",
              onDateClick && "cursor-pointer"
            )}
          >
            {capitalize(weekdayFormatter.format(day))}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full tabular-nums",
                isToday(day) &&
                  "border border-orange bg-orange/20 font-semibold text-orange"
              )}
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
