"use client"

import {
  Check,
  X,
  TriangleAlert,
  Eye,
  ArrowRightToLine,
} from "lucide-react"
import { cn } from "@/lib/util/utils"
import type { CalendarEvent } from "../types"

const taskStatusTextColors: Record<string, string> = {
  done: "stroke-green-600 dark:stroke-green-400",
  cancelled: "stroke-red-600 dark:stroke-red-400",
  in_progress: "stroke-blue-600 dark:stroke-blue-400",
  in_review: "stroke-yellow-600 dark:stroke-yellow-400",
  blocked: "stroke-red-600 dark:stroke-red-400",
} as const

const statusIcons = {
  done: Check,
  cancelled: X,
  in_progress: ArrowRightToLine,
  in_review: Eye,
  blocked: TriangleAlert,
} as const

type TaskStatus = keyof typeof statusIcons

export function TaskStatusIcon({ event }: { event: CalendarEvent }) {
  if (event.meta?.kind !== "task") return null
  const Icon = statusIcons[event.meta.status as TaskStatus]
  if (!Icon) return null
  const color =
    taskStatusTextColors[
      event.meta.status as keyof typeof taskStatusTextColors
    ]
  return (
    <Icon
      aria-hidden
      className={cn(
        "size-3 shrink-0",
        color,
        "dark:text-muted-foreground"
      )}
    />
  )
}
