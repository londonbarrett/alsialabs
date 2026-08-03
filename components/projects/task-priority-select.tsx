"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"

const taskPriorityColors: Record<string, string> = {
  urgent:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
}

interface TaskPrioritySelectProps {
  id?: string
  priority: string | null
  onPriorityChange: (priority: string | null) => void
  disabled?: boolean
  fullWidth?: boolean
}

export function TaskPrioritySelect({
  id,
  priority,
  onPriorityChange,
  disabled,
  fullWidth,
}: TaskPrioritySelectProps) {
  const t = useTranslations()

  const value = priority ?? "none"

  return (
    <Select
      value={value}
      onValueChange={(v) => onPriorityChange(v === "none" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={fullWidth ? "w-full" : "h-7 w-30"}
      >
        <SelectValue>
          <Badge
            className={priority ? taskPriorityColors[priority] : ""}
          >
            {t(`projects.tasks.priority.${value}`)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <Badge>{t("projects.tasks.priority.none")}</Badge>
        </SelectItem>
        {Object.keys(taskPriorityColors).map((p) => (
          <SelectItem key={p} value={p}>
            <Badge className={taskPriorityColors[p]}>
              {t(`projects.tasks.priority.${p}`)}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { taskPriorityColors }
