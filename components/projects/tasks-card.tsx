"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  deleteTask,
  updateTaskPriority,
  updateTaskStatus,
  upsertTask,
} from "@/lib/actions/tasks"
import type { Task } from "@/lib/drizzle/schema"
import { isTaskOverdue } from "@/lib/utils"
import { ListTodo, MessageSquare, Plus, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useReducer, useState, useTransition } from "react"
import { toast } from "sonner"
import { DueDate } from "./due-date"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDialog } from "./task-dialog"
import { TaskPrioritySelect } from "./task-priority-select"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "./task-status-select"

export type TaskWithCommentCount = Task & {
  commentCount: number
  assigneeName: string | null
}

const allTaskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const

const collaboratorTaskStatuses = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
] as const

type TaskAction =
  | { type: "add"; task: TaskWithCommentCount }
  | { type: "update"; task: TaskWithCommentCount }
  | {
      type: "replaceTemp"
      tempId: string
      task: TaskWithCommentCount
    }
  | { type: "delete"; taskId: string }
  | { type: "updateStatus"; taskId: string; status: string }
  | { type: "updatePriority"; taskId: string; priority: string | null }
  | { type: "updateCommentCount"; taskId: string; delta: number }
  | { type: "reset"; tasks: TaskWithCommentCount[] }

// TODO: Move reducer to another file
function taskReducer(
  state: TaskWithCommentCount[],
  action: TaskAction
): TaskWithCommentCount[] {
  switch (action.type) {
    case "add":
      return [action.task, ...state]
    case "update":
      return state.map((t) =>
        t.id === action.task.id ? action.task : t
      )
    case "replaceTemp":
      return state.map((t) =>
        t.id === action.tempId ? action.task : t
      )
    case "delete":
      return state.filter((t) => t.id !== action.taskId)
    case "updateStatus":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              status: action.status as TaskWithCommentCount["status"],
            }
          : t
      )
    case "updatePriority":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              priority:
                action.priority as TaskWithCommentCount["priority"],
            }
          : t
      )
    case "updateCommentCount":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              commentCount: Math.max(0, t.commentCount + action.delta),
            }
          : t
      )
    case "reset":
      return action.tasks
  }
}

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface TasksCardProps {
  initialTasks: TaskWithCommentCount[]
  projectId: string
  canEdit: boolean
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string
  permissions: string[]
  projectMembers: ProjectMember[]
}

export function TasksCard({
  initialTasks,
  projectId,
  canEdit,
  isOwner,
  isCollaborator,
  currentUserId,
  permissions,
  projectMembers,
}: TasksCardProps) {
  const t = useTranslations()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [tasks, dispatch] = useReducer(taskReducer, initialTasks)
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [commentsTask, setCommentsTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const canMutate =
    isOwner && (canEdit || permissions.includes("projects:delete"))

  function getTaskAllowedStatuses(task: Task) {
    if (isOwner) return allTaskStatuses
    if (task.status === "done") return null
    if (isCollaborator && task.assigneeId === currentUserId)
      return collaboratorTaskStatuses
    return null
  }

  function getAssigneeName(task: TaskWithCommentCount) {
    return task.assigneeName || task.assigneeId
  }

  async function handleTaskSubmit(data: {
    name: string
    description: string
    cost: string
    status: string
    priority: string | null
    dueDate: string | null
    assigneeId: string | null
  }) {
    const isEdit = !!editingTask
    setEditingTask(undefined)
    setDialogOpen(false)
    const taskStatus = data.status as
      | "todo"
      | "in_progress"
      | "in_review"
      | "blocked"
      | "done"
    const taskPriority = data.priority as "urgent" | "high" | null

    const optimisticTask: TaskWithCommentCount = {
      id: editingTask?.id ?? `temp-${Date.now()}`,
      projectId,
      name: data.name,
      description: data.description || null,
      cost: data.cost || null,
      status: taskStatus,
      priority: taskPriority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      routineId: editingTask?.routineId ?? null,
      assigneeId: data.assigneeId,
      assigneeName:
        projectMembers.find((m) => m.userId === data.assigneeId)
          ?.userName ?? null,
      commentCount: editingTask
        ? (tasks.find((t) => t.id === editingTask.id)?.commentCount ??
          0)
        : 0,
      createdAt: editingTask?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    dispatch({ type: isEdit ? "update" : "add", task: optimisticTask })

    startLoading()
    const result = await upsertTask(
      { ...data, status: taskStatus, priority: taskPriority },
      projectId,
      editingTask?.id
    )
    stopLoading()

    if (result.success && result.data) {
      const assignee = projectMembers.find(
        (m) => m.userId === result.data!.assigneeId
      )
      const realTask: TaskWithCommentCount = {
        ...result.data!,
        assigneeName:
          assignee?.userName ??
          assignee?.userEmail ??
          result.data!.assigneeName,
        commentCount: optimisticTask.commentCount,
      }
      startTransition(() => {
        dispatch({
          type: "replaceTemp",
          tempId: optimisticTask.id,
          task: realTask,
        })
      })
      toast.success(
        isEdit
          ? t("projects.tasks.taskUpdated")
          : t("projects.tasks.taskCreated")
      )
    } else {
      if (!isEdit) {
        startTransition(() => {
          dispatch({ type: "delete", taskId: optimisticTask.id })
        })
      }
      toast.error(result.error || t("common.somethingWentWrong"))
    }

    return result
  }

  function openNew() {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingTask(undefined)
  }

  async function handleDeleteTask(taskId: string) {
    dispatch({ type: "delete", taskId })
    startLoading()
    const result = await deleteTask(taskId, projectId)
    stopLoading()
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
      startTransition(() => {
        dispatch({ type: "reset", tasks: initialTasks })
      })
    } else {
      toast.success(t("projects.tasks.taskDeleted"))
    }
  }

  async function handleTaskStatusChange(
    taskId: string,
    status: string
  ) {
    dispatch({ type: "updateStatus", taskId, status })
    startLoading()
    const result = await updateTaskStatus(taskId, projectId, status)
    stopLoading()
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
      startTransition(() => {
        dispatch({ type: "reset", tasks: initialTasks })
      })
    } else {
      if (result.nextTask) {
        const assignee = projectMembers.find(
          (m) => m.userId === result.nextTask!.assigneeId
        )
        const nextTask: TaskWithCommentCount = {
          ...result.nextTask,
          assigneeName:
            assignee?.userName ?? assignee?.userEmail ?? null,
          commentCount: 0,
        }
        startTransition(() => {
          dispatch({ type: "add", task: nextTask })
        })
        toast.success(t("projects.routines.nextOccurrenceCreated"))
      }
    }
  }

  async function handleTaskPriorityChange(
    taskId: string,
    priority: string | null
  ) {
    dispatch({ type: "updatePriority", taskId, priority })
    startLoading()
    const result = await updateTaskPriority(taskId, projectId, priority)
    stopLoading()
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
      startTransition(() => {
        dispatch({ type: "reset", tasks: initialTasks })
      })
    } else {
      toast.success(t("projects.tasks.priorityChanged"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            {t("projects.tasks.title")}
          </span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t("projects.tasks.addTask")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("projects.tasks.noTasks")}
          </p>
        ) : (
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
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    onDoubleClick={() => setCommentsTask(task)}
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
                      {(() => {
                        const allowed = getTaskAllowedStatuses(task)
                        if (!allowed) {
                          return (
                            <Badge
                              className={taskStatusColors[task.status]}
                            >
                              {t(
                                `projects.tasks.status.${task.status}`
                              )}
                            </Badge>
                          )
                        }
                        return (
                          <TaskStatusSelect
                            status={task.status}
                            allowedStatuses={allowed}
                            onStatusChange={(v) =>
                              handleTaskStatusChange(task.id, v)
                            }
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {isOwner && canEdit ? (
                        <TaskPrioritySelect
                          priority={task.priority}
                          onPriorityChange={(p) =>
                            handleTaskPriorityChange(task.id, p)
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {task.priority
                            ? t(
                                `projects.tasks.priority.${task.priority}`
                              )
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
                        overdue={isTaskOverdue(
                          task.status,
                          task.dueDate
                        )}
                        overdueLabel={t("projects.tasks.overdue")}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        onClick={() => setCommentsTask(task)}
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
                          onEdit={() => openEdit(task)}
                          onDelete={() => handleDeleteTask(task.id)}
                          canEdit={canEdit}
                          canDelete={permissions.includes(
                            "projects:delete"
                          )}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <TaskDialog
        task={editingTask}
        projectMembers={projectMembers}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={handleTaskSubmit}
      />

      {commentsTask && (
        <TaskCommentsPanel
          taskId={commentsTask.id}
          taskName={commentsTask.name}
          description={commentsTask.description}
          open={!!commentsTask}
          onOpenChange={(open) => {
            if (!open) setCommentsTask(undefined)
          }}
          currentUserId={currentUserId}
          isOwner={isOwner}
          onCommentCountChange={(taskId, delta) =>
            dispatch({ type: "updateCommentCount", taskId, delta })
          }
        />
      )}
    </Card>
  )
}
