"use client"

import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "next-intl"

const taskStatusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  blocked:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400",
}

interface TaskStatusSelectProps {
  id?: string
  status: string
  allowedStatuses: readonly string[]
  onStatusChange: (status: string) => void
  fullWidth?: boolean
}

export function TaskStatusSelect({
  id,
  status,
  allowedStatuses,
  onStatusChange,
  fullWidth,
}: TaskStatusSelectProps) {
  const t = useTranslations()

  return (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger
        id={id}
        className={fullWidth ? "w-full" : "h-7 w-35"}
      >
        <SelectValue>
          <Badge className={taskStatusColors[status]}>
            {t(`projects.tasks.status.${status}`)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowedStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            <Badge className={taskStatusColors[s]}>
              {t(`projects.tasks.status.${s}`)}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { taskStatusColors }
