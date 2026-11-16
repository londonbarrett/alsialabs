"use client"

import type { TasksVisibilityFilter } from "@/lib/tasks/list"
import { cn } from "cn"
import { useTranslations } from "next-intl"

const OPTIONS: readonly TasksVisibilityFilter[] = [
  "unfinished",
  "both",
  "finished",
]

export function TasksFilter({
  value,
  onChange,
}: {
  value: TasksVisibilityFilter
  onChange: (value: TasksVisibilityFilter) => void
}) {
  const t = useTranslations("projects.tasks")

  return (
    <div
      role="group"
      className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(option)}
        </button>
      ))}
    </div>
  )
}
