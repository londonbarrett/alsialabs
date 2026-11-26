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
import { isTerminalStatus } from "@/lib/util/project-roles"
import { formatAssignmentDueDate } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useLocale, useTranslations } from "next-intl"
import { AssignmentDetailsCells } from "./assignment-details-cells"
import { assignmentColumnCount } from "./assignment-columns"
import { taskStatusColors } from "./task-status-select"

interface TaskClosedAssignmentRowsProps {
  taskId: string
  assignments: TaskAssignmentDTO[]
  /** Project zone every occurrence in this task is displayed in. */
  timeZone: string
  onReopen?: (assignmentId: string) => void
  /**
   * Total table columns the filler cells must pad out to. Defaults to
   * the tasks table's arrangement; a caller rendering these rows in a
   * table with a different column set passes its own count.
   */
  columnCount?: number
  /**
   * Cell order for the leading cells: four rendered in the expenses table
   * (Description / Type / Amount / Date) and five in the tasks table
   * (Assignee / spacer / Status / Cost / Due date). Cost and its labeled
   * comment input share one cell, so the comment stays with the editable
   * cost or amount.
   */
  cellOrder?: "tasks" | "expenses"
  /** Show only the occurrence date, never its time. */
  dateOnly?: boolean
}

/**
 * Terminal rows only: a status badge always, plus a Reopen control when
 * the caller passes one (managers, non-repeating tasks — the caller
 * gates recurrence). Rows render in the order given — the history
 * panel's merged region and the list's terminal slice each arrive
 * already ordered.
 */
export function TaskClosedAssignmentRows({
  taskId,
  assignments,
  timeZone,
  onReopen,
  columnCount,
  cellOrder = "tasks",
  dateOnly = false,
}: TaskClosedAssignmentRowsProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEditProject || canDeleteProject)
  // Cost editing is role-gated on the server (canManageWork), so the input
  // follows the same owner/admin fact — no separate permission code here.
  const canEditCost = isOwner || isAdmin

  // The header renders the actions column only for mutators; the empty
  // filler cells must match that column count exactly.
  const columns = columnCount ?? assignmentColumnCount(canMutate)
  const align = "text-center"

  return assignments.map((assignment) => {
    // A row is one occurrence: show its due date, with time only for timed
    // work, never a start–end range or the task's all-day header date.
    const occurrence = assignment.endDate
      ? formatAssignmentDueDate(
          assignment.endDate,
          locale,
          timeZone,
          dateOnly ? null : assignment.startTime
        )
      : "—"

    const assigneeCell = (
      <TableCell key="assignee" className="pl-8">
        <span className="flex items-center gap-2">
          <Avatar size="sm" className="border-2 border-background">
            <AvatarImage src={assignment.userImage ?? undefined} alt="" />
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
    )
    const dateCell = (
      <TableCell key="date" className={align}>
        <span>{occurrence}</span>
      </TableCell>
    )
    const statusCell = (
      <TableCell key="status" className={align}>
        <div className="flex justify-center">
          <span className="flex flex-wrap items-center justify-center gap-2">
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
        </div>
      </TableCell>
    )
    // Cost and its labeled comment are one cell rendered by one component.
    const detailsCells = (
      <AssignmentDetailsCells
        key="details"
        taskId={taskId}
        assignmentId={assignment.id}
        cost={assignment.cost}
        comment={assignment.comment}
        terminal={isTerminalStatus(assignment.status)}
        canEdit={canEditCost}
      />
    )
    // The expenses headers are Description / Type / Amount / Date; the tasks
    // headers put status in Status and the occurrence in Due date, leaving the
    // Assignees cell empty in between.
    const isExpenses = cellOrder === "expenses"
    const leadingCells = isExpenses
      ? [assigneeCell, statusCell, detailsCells, dateCell]
      : [
          assigneeCell,
          <TableCell key="spacer" className={align} />,
          statusCell,
          detailsCells,
          dateCell,
        ]
    // The cells component renders one <td>: four leading cells in expenses,
    // five in the tasks arrangement.
    const renderedLeadingCells = isExpenses ? 4 : 5

    return (
      <TableRow key={assignment.id}>
        {leadingCells}
        {Array.from(
          { length: columns - renderedLeadingCells },
          (_, index) => (
            <TableCell key={index} className={align} />
          )
        )}
      </TableRow>
    )
  })
}
