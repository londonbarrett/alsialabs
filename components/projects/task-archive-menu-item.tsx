"use client"

import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { isOpenAssignment } from "@/lib/tasks/filter"
import { Archive, ArchiveRestore } from "lucide-react"
import { useTranslations } from "next-intl"

interface TaskArchiveMenuItemProps {
  task: TaskWithAssignmentsDTO
  canArchive: boolean
  onArchiveRequest: () => void
  onArchiveDirect: () => void
  onUnarchive: () => void
}

export function TaskArchiveMenuItem({
  task,
  canArchive,
  onArchiveRequest,
  onArchiveDirect,
  onUnarchive,
}: TaskArchiveMenuItemProps) {
  const t = useTranslations("projects.tasks")

  if (!canArchive) return null

  const handleArchive = () => {
    // Nothing open means there is no disposition to choose: archive now
    // rather than asking which status to close.
    if (task.assignments.some(isOpenAssignment)) onArchiveRequest()
    else onArchiveDirect()
  }

  return task.archived ? (
    <DropdownMenuItem onClick={onUnarchive}>
      <ArchiveRestore className="mr-2 h-4 w-4" />
      {t("unarchiveTask")}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onClick={handleArchive}>
      <Archive className="mr-2 h-4 w-4" />
      {t("archiveTask")}
    </DropdownMenuItem>
  )
}
