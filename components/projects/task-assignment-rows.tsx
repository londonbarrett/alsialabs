"use client"

import type {
  TaskAssignmentDTO,
  TaskStatus,
} from "@/actions/tasks/schemas"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { sortAssignments } from "@/lib/tasks/assignments"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { TaskStatusSelect, taskStatusColors } from "./task-status-select"

interface TaskAssignmentRowsProps {
  taskId: string
  assignments: TaskAssignmentDTO[]
  onStatusChange: (
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) => void
}

export function TaskAssignmentRows({
  taskId,
  assignments,
  onStatusChange,
}: TaskAssignmentRowsProps) {
  const t = useTranslations()
  const { currentUserId, isOwner, isAdmin, isCollaborator } =
    useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = (isOwner || isAdmin) && canEditProject
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEdit || canDeleteProject)

  // The header renders the actions column only for mutators; the empty
  // filler cells must match that column count exactly.
  const columnCount = canMutate ? 7 : 6

  function getAllowedStatuses(assignment: TaskAssignmentDTO) {
    if (isOwner || isAdmin) return ALL_TASK_STATUSES
    if (isTerminalStatus(assignment.status)) return null
    if (isCollaborator && assignment.userId === currentUserId) {
      return COLLABORATOR_TASK_STATUSES
    }
    return null
  }

  return sortAssignments(assignments).map((assignment) => {
    // Terminal rows are read-only history — a badge, never a select,
    // even on the owner/admin path of getAllowedStatuses.
    const allowed = isTerminalStatus(assignment.status)
      ? null
      : getAllowedStatuses(assignment)
    const occurrence = [assignment.startDate, assignment.endDate]
      .filter((date): date is Date => date !== null)
      .map((date) => date.toLocaleDateString())
      .join(" – ")

    return (
      <TableRow key={assignment.id}>
        <TableCell className="pl-8">
          <span className="flex items-center gap-2">
            <Avatar
              size="sm"
              className="border-2 border-background"
            >
              <AvatarImage
                src={assignment.userImage ?? undefined}
                alt=""
              />
              <AvatarFallback>
                {(assignment.userName || assignment.userEmail || "")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex flex-col">
              <span className="text-sm">
                {assignment.userName || assignment.userEmail}
              </span>
              {assignment.userName && assignment.userEmail && (
                <span className="text-xs text-muted-foreground">
                  {assignment.userEmail}
                </span>
              )}
            </span>
          </span>
        </TableCell>
        <TableCell>{occurrence || "—"}</TableCell>
        <TableCell>
          {allowed ? (
            <TaskStatusSelect
              status={assignment.status}
              allowedStatuses={allowed}
              onStatusChange={(status) =>
                onStatusChange(taskId, assignment.id, status)
              }
            />
          ) : (
            <Badge className={taskStatusColors[assignment.status]}>
              {t(`projects.tasks.status.${assignment.status}`)}
            </Badge>
          )}
        </TableCell>
        {Array.from({ length: columnCount - 3 }, (_, index) => (
          <TableCell key={index} />
        ))}
      </TableRow>
    )
  })
}
