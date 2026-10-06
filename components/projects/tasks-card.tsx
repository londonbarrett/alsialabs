"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useHasPermission } from "@/components/common/permissions-provider"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import type { TaskWithCommentCount } from "@/stores/project-tasks/project-tasks-reducer"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useProjectTasksState } from "@/stores/project-tasks/use-project-tasks-state"
import type { TaskPriority, TaskStatus } from "@/lib/drizzle/schema"
import { ListTodo, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ProjectTaskCommentsPanel } from "./project-task-comments-panel"
import { TaskDialog } from "./task-dialog"
import { TasksTable } from "./tasks-table"

export function TasksCard() {
  const t = useTranslations()
  const { projectId, members, currentUserId, isOwner } =
    useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = isOwner && canEditProject
  const { tasks } = useProjectTasksState()
  const { saveTask, deleteTask, updateTaskStatus, updateTaskPriority } =
    useProjectTasksActions()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const [commentsTask, setCommentsTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  const openNew = () => {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  const openEdit = (task: TaskWithCommentCount) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingTask(undefined)
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
        members.find((m) => m.userId === data.assigneeId)?.userName ??
        editingTask?.assigneeName ??
        null,
      commentCount: editingTask
        ? (tasks.find((t) => t.id === editingTask.id)?.commentCount ??
          0)
        : 0,
      createdAt: editingTask?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    await saveTask({
      projectId,
      values: data,
      optimisticTask,
      editingTaskId: editingTask?.id ?? null,
    })
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
            onStatusChange={(taskId, status) =>
              updateTaskStatus(projectId, taskId, status)
            }
            onPriorityChange={(taskId, priority) =>
              updateTaskPriority(projectId, taskId, priority)
            }
            onDelete={(taskId) => deleteTask(projectId, taskId)}
            onEdit={openEdit}
            onComments={(task) => {
              setCommentsTask(task)
              setIsCommentsOpen(true)
            }}
          />
        )}
      </CardContent>

      <TaskDialog
        task={editingTask}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={handleTaskSubmit}
      />

      <ProjectTaskCommentsPanel
        key={commentsTask?.id ?? "empty"}
        task={commentsTask}
        open={isCommentsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCommentsOpen(false)
            setTimeout(() => setCommentsTask(undefined), 300)
          }
        }}
        currentUserId={currentUserId}
        isOwner={isOwner}
      />
    </Card>
  )
}
