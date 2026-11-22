import type { MenuAction } from "@/lib/types"
import { isOpenAssignment } from "@/lib/tasks/filter"
import { Archive, ArchiveRestore } from "lucide-react"

interface CreateTaskArchiveActionInput {
  labels: {
    archive: string
    unarchive: string
  }
  task: {
    archived: boolean
    assignments: { status: string }[]
  }
  canArchive: boolean
  onArchiveRequest: () => void
  onArchiveDirect: () => void
  onUnarchive: () => void
}

/** Builds the task archive/unarchive action for the shared row action menu. */
export function createTaskArchiveAction({
  labels,
  task,
  canArchive,
  onArchiveRequest,
  onArchiveDirect,
  onUnarchive,
}: CreateTaskArchiveActionInput): MenuAction | null {
  if (!canArchive) return null

  if (task.archived) {
    return {
      key: "archive",
      label: labels.unarchive,
      icon: ArchiveRestore,
      onSelect: onUnarchive,
    }
  }

  return {
    key: "archive",
    label: labels.archive,
    icon: Archive,
    onSelect: () => {
      // Nothing open means there is no disposition to choose: archive now
      // rather than asking which status to close.
      if (task.assignments.some(isOpenAssignment)) onArchiveRequest()
      else onArchiveDirect()
    },
  }
}
