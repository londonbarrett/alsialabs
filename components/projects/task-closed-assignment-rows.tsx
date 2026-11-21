"use client"

import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatAssignmentDueDate } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useLocale, useTranslations } from "next-intl"
import { assignmentColumnCount } from "./assignment-columns"
import { taskStatusColors } from "./task-status-select"

interface TaskClosedAssignmentRowsProps {
  taskId: string
  assignments: TaskAssignmentDTO[]
  onReopen?: (assignmentId: string) => void
}

/**
 * Terminal rows only: a status badge always, plus a Reopen control when
 * the caller passes one (managers, non-repeating tasks — the caller
 * gates recurrence). Rows render in the order given — the history
 * panel's merged region and the list's terminal slice each arrive
 * already ordered.
 */
export function TaskClosedAssignmentRows({
  assignments,
  onReopen,
}: TaskClosedAssignmentRowsProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEditProject || canDeleteProject)

  // The header renders the actions column only for mutators; the empty
  // filler cells must match that column count exactly.
  const columnCount = assignmentColumnCount(canMutate)

  return assignments.map((assignment) => {
    // A row is one occurrence: show its due timestamp (with time, even at
    // midnight), never a start–end range or the task's all-day header date.
    const occurrence = assignment.endDate
      ? formatAssignmentDueDate(assignment.endDate, locale)
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
        <TableCell>{occurrence}</TableCell>
        <TableCell>
          <span className="flex items-center gap-2">
            <Badge className={taskStatusColors[assignment.status]}>
              {t(`projects.tasks.status.${assignment.status}`)}
            </Badge>
            {onReopen && (isOwner || isAdmin) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReopen(assignment.id)}
              >
                {t("projects.tasks.reopen")}
              </Button>
            )}
          </span>
        </TableCell>
        {Array.from({ length: columnCount - 3 }, (_, index) => (
          <TableCell key={index} />
        ))}
      </TableRow>
    )
  })
}
