"use client"

import type {
  TaskAssignmentDTO,
  TaskStatus,
} from "@/actions/tasks/schemas"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/actions/tasks/schemas"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { sortAssignments } from "@/lib/tasks/assignments"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { formatAssignmentDueDate } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useLocale, useTranslations } from "next-intl"
import { AssignmentDetailsCells } from "./assignment-details-cells"
import { TaskStatusSelect, taskStatusColors } from "./task-status-select"

interface TaskOpenAssignmentRowsProps {
  taskId: string
  assignments: TaskAssignmentDTO[]
  /** Project zone every occurrence in this task is displayed in. */
  timeZone: string
  onStatusChange: (
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) => void
}

export function TaskOpenAssignmentRows({
  taskId,
  assignments,
  timeZone,
  onStatusChange,
}: TaskOpenAssignmentRowsProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { currentUserId, isOwner, isAdmin, isCollaborator } =
    useProjectContextState()
  // Cost/comment editing is role-gated on the server (canManageWork), so the
  // inputs follow the same owner/admin fact — no separate permission code.
  const canEditCost = isOwner || isAdmin

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
    // A row is one occurrence: show its due date, with time only for timed
    // work, never a start–end range or the task's all-day header date.
    const occurrence = assignment.endDate
      ? formatAssignmentDueDate(assignment.endDate, locale, timeZone, null)
      : "—"

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
        <TableCell className="text-center">
          <div className="flex justify-center">
            {allowed ? (
              <TaskStatusSelect
                status={assignment.status}
                allowedStatuses={allowed}
                onStatusChange={(status) =>
                  onStatusChange(taskId, assignment.id, status)
                }
              />
            ) : (
              <span className="flex items-center gap-2">
                <Badge className={taskStatusColors[assignment.status]}>
                  {t(`projects.tasks.status.${assignment.status}`)}
                </Badge>
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <span>{occurrence}</span>
        </TableCell>
        <AssignmentDetailsCells
          taskId={taskId}
          assignmentId={assignment.id}
          cost={assignment.cost}
          comment={assignment.comment}
          terminal={isTerminalStatus(assignment.status)}
          canEdit={canEditCost}
          commentColSpan={3}
        />
      </TableRow>
    )
  })
}
