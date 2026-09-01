"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
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
import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/drizzle/schema"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/lib/schemas/task"
import { isTaskOverdue } from "@/lib/util/utils"
import type { TaskWithCommentCount } from "@/reducers/task-reducer"
import { MessageSquare, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { DueDate } from "./due-date"
import { TaskPrioritySelect } from "./task-priority-select"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "./task-status-select"

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface TasksTableProps {
  tasks: TaskWithCommentCount[]
  canEdit: boolean
  canMutate: boolean
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string
  projectMembers: ProjectMember[]
  permissions: string[]
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  onDelete: (taskId: string) => Promise<void>
  onEdit: (task: TaskWithCommentCount) => void
  onComments: (task: TaskWithCommentCount) => void
}

export function TasksTable({
  tasks,
  canEdit,
  canMutate,
  isOwner,
  isCollaborator,
  currentUserId,
  projectMembers,
  permissions,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onEdit,
  onComments,
}: TasksTableProps) {
  const t = useTranslations()

  function getTaskAllowedStatuses(task: Task) {
    if (isOwner) return ALL_TASK_STATUSES
    if (task.status === "done" || task.status === "cancelled")
      return null
    if (isCollaborator && task.assigneeId === currentUserId)
      return COLLABORATOR_TASK_STATUSES
    return null
  }

  function getAssigneeName(task: TaskWithCommentCount) {
    if (task.assigneeName) return task.assigneeName
    const member = projectMembers.find(
      (m) => m.userId === task.assigneeId
    )
    return member?.userEmail ?? task.assigneeId
  }

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {t("projects.tasks.name")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.tasks.assignee")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.tasks.statusLabel")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.tasks.priorityLabel")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.tasks.cost")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.tasks.dueDate")}
            </TableHead>
            <TableHead scope="col" className="w-12" />
            {canMutate && (
              <TableHead scope="col">
                {t("projects.tasks.actions")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const allowed = getTaskAllowedStatuses(task)
            return (
              <TableRow
                key={task.id}
                onDoubleClick={() => onComments(task)}
              >
                <TableCell className="font-medium">
                  <div>
                    <div className="flex items-center gap-2">
                      <p>{task.name}</p>
                      {task.routineId && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t("projects.routines.routine")}
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
                  {task.assigneeId ? (
                    <span className="text-sm">
                      {getAssigneeName(task)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("projects.tasks.unassigned")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {allowed ? (
                    <TaskStatusSelect
                      status={task.status}
                      allowedStatuses={allowed}
                      onStatusChange={(v) => onStatusChange(task.id, v)}
                    />
                  ) : (
                    <Badge className={taskStatusColors[task.status]}>
                      {t(`projects.tasks.status.${task.status}`)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isOwner && canEdit ? (
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
                  {task.cost ? <Money value={task.cost} /> : "—"}
                </TableCell>
                <TableCell>
                  <DueDate
                    date={task.dueDate}
                    overdue={isTaskOverdue(task.status, task.dueDate)}
                    overdueLabel={t("projects.tasks.overdue")}
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
                      canDelete={permissions.includes(
                        "projects:delete"
                      )}
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
