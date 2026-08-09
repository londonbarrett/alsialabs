"use client"

import { cn } from "@/lib/util/utils"
import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"

const steps = ["stepDetails", "stepScheduling"] as const

export function StepIndicator({
  current,
  editMode,
  step1Done,
  onSelect,
}: {
  current: number
  editMode: boolean
  step1Done: boolean
  onSelect: (n: number) => void
}) {
  const t = useTranslations("projects.routines")
  return (
    <ol className="mb-6 grid grid-cols-2 gap-4">
      {steps.map((step, i) => {
        const n = i + 1
        const active = current === n
        const done = current > n
        const clickable = editMode || done || (step1Done && n > current)
        return (
          <li key={step} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(n)}
              className={cn(
                "flex items-center gap-2 disabled:cursor-default",
                clickable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active &&
                    "bg-foreground text-background ring-2 ring-foreground/20",
                  !active && !done && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="size-3" /> : n}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active || done
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {t(step)}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
