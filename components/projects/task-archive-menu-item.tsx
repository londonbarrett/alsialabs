"use client"

import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Archive, ArchiveRestore } from "lucide-react"
import { useTranslations } from "next-intl"

interface TaskArchiveMenuItemProps {
  task: TaskWithAssignmentsDTO
  canArchive: boolean
  onArchiveRequest: () => void
  onUnarchive: () => void
}

export function TaskArchiveMenuItem({
  task,
  canArchive,
  onArchiveRequest,
  onUnarchive,
}: TaskArchiveMenuItemProps) {
  const t = useTranslations("projects.tasks")

  if (!canArchive) return null

  return task.archived ? (
    <DropdownMenuItem onClick={onUnarchive}>
      <ArchiveRestore className="mr-2 h-4 w-4" />
      {t("unarchiveTask")}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onClick={onArchiveRequest}>
      <Archive className="mr-2 h-4 w-4" />
      {t("archiveTask")}
    </DropdownMenuItem>
  )
}
