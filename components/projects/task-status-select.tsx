"use client"

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
}

interface TaskStatusSelectProps {
  status: string
  allowedStatuses: readonly string[]
  onStatusChange: (status: string) => void
}

export function TaskStatusSelect({
  status,
  allowedStatuses,
  onStatusChange,
}: TaskStatusSelectProps) {
  const t = useTranslations()

  return (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger className="h-7 w-35">
        <SelectValue>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusColors[status]}`}
          >
            {t(`projects.tasks.status.${status}`)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowedStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusColors[s]}`}
            >
              {t(`projects.tasks.status.${s}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { taskStatusColors }
