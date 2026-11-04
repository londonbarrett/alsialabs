"use client"

import type {
  TaskAssignmentDTO,
  TaskPriorityDTO,
  TaskStatus,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/actions/tasks/schemas"
import { ActionMenu } from "@/components/common/action-menu"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { isTaskOverdue } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { MessageSquare, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { DueDate } from "./due-date"
import { TaskPrioritySelect } from "./task-priority-select"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "./task-status-select"

interface TasksTableProps {
  tasks: TaskWithAssignmentsDTO[]
  onStatusChange: (
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) => void
  onPriorityChange: (taskId: string, priority: TaskPriorityDTO) => void
  onDelete: (taskId: string) => Promise<void>
  onEdit: (task: TaskWithAssignmentsDTO) => void
  onComments: (task: TaskWithAssignmentsDTO) => void
}

export function TasksTable({
  tasks,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onEdit,
  onComments,
}: TasksTableProps) {
  const t = useTranslations()
  const { members, currentUserId, isOwner, isAdmin, isCollaborator } =
    useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = (isOwner || isAdmin) && canEditProject
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEdit || canDeleteProject)

  function getAllowedStatuses(assignment: TaskAssignmentDTO) {
    if (isOwner || isAdmin) return ALL_TASK_STATUSES
    if (isTerminalStatus(assignment.status)) return null
    if (isCollaborator && assignment.userId === currentUserId) {
      return COLLABORATOR_TASK_STATUSES
    }
    return null
  }

  function assignmentName(assignment: TaskAssignmentDTO) {
    if (assignment.userName) return assignment.userName
    return assignmentEmail(assignment) ?? assignment.userId
  }

  function assignmentEmail(assignment: TaskAssignmentDTO) {
    if (assignment.userEmail) return assignment.userEmail
    return (
      members.find((m) => m.userId === assignment.userId)?.userEmail ??
      null
    )
  }

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {t("projects.tasks.name")}
            </TableHead>
            <TableHead scope="col">{t("common.assignee")}</TableHead>
            <TableHead scope="col">{t("common.status")}</TableHead>
            <TableHead scope="col">{t("common.priority")}</TableHead>
            <TableHead scope="col">{t("common.dueDate")}</TableHead>
            <TableHead scope="col" className="w-12" />
            {canMutate && (
              <TableHead scope="col">{t("common.actions")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const assignment = task.assignments[0]
            const allowed = assignment
              ? getAllowedStatuses(assignment)
              : null
            return (
              <TableRow
                key={task.id}
                onDoubleClick={() => onComments(task)}
              >
                <TableCell className="font-medium">
                  <div>
                    <div className="flex items-center gap-2">
                      <p>{task.name}</p>
                      {task.recurrence && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t("projects.tasks.recurring")}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {assignment ? (
                    <span className="flex flex-col">
                      <span className="text-sm">
                        {assignmentName(assignment)}
                      </span>
                      {assignment.userName && assignmentEmail(assignment) && (
                        <span className="text-xs text-muted-foreground">
                          {assignmentEmail(assignment)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("common.unassigned")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {assignment && allowed ? (
                    <TaskStatusSelect
                      status={assignment.status}
                      allowedStatuses={allowed}
                      onStatusChange={(v) =>
                        onStatusChange(task.id, assignment.id, v)
                      }
                    />
                  ) : assignment ? (
                    <Badge
                      className={taskStatusColors[assignment.status]}
                    >
                      {t(`projects.tasks.status.${assignment.status}`)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {(isOwner || isAdmin) && canEdit ? (
                    <TaskPrioritySelect
                      priority={task.priority}
                      onPriorityChange={(p) =>
                        onPriorityChange(task.id, p)
                      }
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {task.priority
                        ? t(`projects.tasks.priority.${task.priority}`)
                        : t("projects.tasks.priority.none")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <DueDate
                    date={assignment?.endDate ?? null}
                    overdue={
                      assignment
                        ? isTaskOverdue(
                            assignment.status,
                            assignment.endDate
                          )
                        : false
                    }
                    overdueLabel={t("common.overdue")}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="secondary"
                    onClick={() => onComments(task)}
                    className="gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs text-muted-foreground">
                      {task.commentCount}
                    </span>
                  </Button>
                </TableCell>
                {canMutate && (
                  <TableCell>
                    <ActionMenu
                      entityName={task.name}
                      onEdit={() => onEdit(task)}
                      onDelete={() => onDelete(task.id)}
                      canEdit={canEdit}
                      canDelete={canDeleteProject}
                    />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
