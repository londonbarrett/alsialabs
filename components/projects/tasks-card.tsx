"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  deleteTask,
  updateTaskPriority,
  updateTaskStatus,
  upsertTask,
} from "@/lib/actions/tasks"
import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/drizzle/schema"
import {
  taskReducer,
  type TaskWithCommentCount,
} from "@/reducers/task-reducer"
import { useActionError } from "@/lib/util/action-errors"
import { ListTodo, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useReducer, useState, useTransition } from "react"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDialog } from "./task-dialog"
import { TasksTable } from "./tasks-table"

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
  const [editingTask, setEditingTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const [commentsTask, setCommentsTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const canMutate =
    isOwner && (canEdit || permissions.includes("projects:delete"))
  const translateError = useActionError()
  const { executeAsync: executeUpsert } = useAction(upsertTask)
  const { executeAsync: executeDelete } = useAction(deleteTask)
  const { executeAsync: executeStatus } = useAction(updateTaskStatus)
  const { executeAsync: executePriority } =
    useAction(updateTaskPriority)

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
    const taskStatus = data.status as TaskStatus
    const taskPriority = data.priority as TaskPriority

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
          ?.userName ??
        editingTask?.assigneeName ??
        null,
      commentCount: editingTask
        ? (tasks.find((t) => t.id === editingTask.id)?.commentCount ??
          0)
        : 0,
      createdAt: editingTask?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    dispatch({ type: isEdit ? "update" : "add", task: optimisticTask })

    startLoading()
    const result = await executeUpsert({
      projectId,
      taskId: editingTask?.id,
      name: data.name,
      description: data.description,
      cost: data.cost,
      status: taskStatus,
      priority: taskPriority,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
    })
    stopLoading()

    if (result?.data) {
      const assignee = projectMembers.find(
        (m) => m.userId === result.data!.assigneeId
      )
      const realTask: TaskWithCommentCount = {
        ...result.data!,
        assigneeName:
          assignee?.userName ??
          assignee?.userEmail ??
          (result.data as unknown as { assigneeName: string | null })
            .assigneeName,
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
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
      } else {
        toast.error(t("common.somethingWentWrong"))
      }
    }

    return result
  }

  function openNew() {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  function openEdit(task: TaskWithCommentCount) {
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
    const result = await executeDelete({ projectId, taskId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      startTransition(() => {
        dispatch({ type: "reset", tasks: initialTasks })
      })
    } else {
      toast.success(t("projects.tasks.taskDeleted"))
    }
  }

  async function handleTaskStatusChange(
    taskId: string,
    status: TaskStatus
  ) {
    dispatch({ type: "updateStatus", taskId, status })
    startLoading()
    const result = await executeStatus({ projectId, taskId, status })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      startTransition(() => {
        dispatch({ type: "reset", tasks: initialTasks })
      })
    } else {
      toast.success(t("projects.tasks.statusChanged"))
      const nextTask = (result?.data as unknown as { nextTask?: Task })
        ?.nextTask
      if (nextTask) {
        const assignee = projectMembers.find(
          (m) => m.userId === nextTask!.assigneeId
        )
        const mapped: TaskWithCommentCount = {
          ...nextTask,
          assigneeName:
            assignee?.userName ?? assignee?.userEmail ?? null,
          commentCount: 0,
        }
        startTransition(() => {
          dispatch({ type: "add", task: mapped })
        })
        toast.success(t("projects.routines.nextOccurrenceCreated"))
      }
    }
  }

  async function handleTaskPriorityChange(
    taskId: string,
    priority: TaskPriority
  ) {
    dispatch({
      type: "updatePriority",
      taskId,
      priority,
    })
    startLoading()
    const result = await executePriority({
      projectId,
      taskId,
      priority,
    })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
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
          <TasksTable
            tasks={tasks}
            canEdit={canEdit}
            canMutate={canMutate}
            isOwner={isOwner}
            isCollaborator={isCollaborator}
            currentUserId={currentUserId}
            projectMembers={projectMembers}
            permissions={permissions}
            onStatusChange={handleTaskStatusChange}
            onPriorityChange={handleTaskPriorityChange}
            onDelete={handleDeleteTask}
            onEdit={openEdit}
            onComments={setCommentsTask}
          />
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
