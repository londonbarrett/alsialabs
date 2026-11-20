"use client"

import type {
  TaskAssignmentDTO,
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { selectTasks, type TasksVisibilityFilter } from "@/lib/tasks/list"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useProjectTasksState } from "@/stores/project-tasks/use-project-tasks-state"
import { ListTodo, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ProjectTaskCommentsPanel } from "./project-task-comments-panel"
import { TaskDialog, type TaskFormValues } from "./task-dialog"
import { TasksFilter } from "./tasks-filter"
import { TasksTable } from "./tasks-table"

export function TasksCard() {
  const t = useTranslations()
  const { projectId, members, currentUserId, isOwner, isAdmin } =
    useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = (isOwner || isAdmin) && canEditProject
  const { tasks } = useProjectTasksState()
  const {
    createTask,
    updateTask,
    deleteTask,
    archiveTask,
    unarchiveTask,
    updateAssignmentStatus,
    updateTaskPriority,
  } = useProjectTasksActions()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<
    TaskWithAssignmentsDTO | undefined
  >()
  const [commentsTask, setCommentsTask] = useState<
    TaskWithAssignmentsDTO | undefined
  >()
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [filter, setFilter] = useState<TasksVisibilityFilter>("open")

  const visibleTasks = selectTasks(tasks, filter)

  const openNew = () => {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  const openEdit = (task: TaskWithAssignmentsDTO) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingTask(undefined)
  }

  function buildOptimisticTask(
    data: TaskFormValues,
    editing: TaskWithAssignmentsDTO | undefined
  ): TaskWithAssignmentsDTO {
    const tempId = editing?.id ?? `temp-${Date.now()}`
    const startDate = data.startDate ? new Date(data.startDate) : null
    const endDate = data.endDate ? new Date(data.endDate) : null

    const assignments: TaskAssignmentDTO[] = data.assigneeIds.map(
      (userId, index) => {
        const member = members.find((m) => m.userId === userId)
        const existing = editing?.assignments.find(
          (a) => a.userId === userId
        )
        return {
          id: existing?.id ?? `temp-assignment-${tempId}-${index}`,
          taskId: tempId,
          userId,
          userName: member?.userName ?? existing?.userName ?? null,
          userEmail: member?.userEmail ?? existing?.userEmail ?? null,
          userImage: member?.userImage ?? existing?.userImage ?? null,
          status: existing?.status ?? "todo",
          comment: existing?.comment ?? null,
          startDate: existing?.startDate ?? startDate,
          endDate: existing?.endDate ?? endDate,
        }
      }
    )

    const optimisticTask: TaskWithAssignmentsDTO = {
      id: tempId,
      projectId,
      name: data.name,
      description: data.description || null,
      priority: data.priority as TaskPriorityDTO,
      startDate,
      endDate,
      // The form owns the schedule it just submitted — taking it from
      // `editingTask` showed a freshly created repeating task as plain
      // (and made an immediate re-edit open with the window).
      recurrence: data.recurrence,
      interval: Number(data.interval) || 1,
      daysOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      archived: editing?.archived ?? false,
      createdAt: editing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      assignments,
      assigneeIds: data.assigneeIds,
      commentCount: editing
        ? (tasks.find((t) => t.id === editing.id)?.commentCount ?? 0)
        : 0,
      // Momentary approximation while the optimistic row is on screen:
      // the server's true total (rows behind Load More included)
      // replaces it on the create/update commit.
      closedCount: assignments.filter((a) =>
        isTerminalStatus(a.status)
      ).length,
    }

    return optimisticTask
  }

  function handleTaskSubmit(data: TaskFormValues) {
    setEditingTask(undefined)
    setDialogOpen(false)

    const optimisticTask = buildOptimisticTask(data, editingTask)

    if (editingTask) {
      updateTask({
        projectId,
        taskId: editingTask.id,
        values: data,
        optimisticTask,
        unassignAs: data.unassignAs,
      })
    } else {
      createTask({ projectId, values: data, optimisticTask })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            {t("common.tasks")}
          </span>
          <TasksFilter value={filter} onChange={setFilter} />
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t("projects.tasks.addTask")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visibleTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {filter === "archived"
              ? t("projects.tasks.noArchived")
              : t("projects.tasks.noTasks")}
          </p>
        ) : (
          <TasksTable
            tasks={visibleTasks}
            onStatusChange={(taskId, assignmentId, status) =>
              updateAssignmentStatus(
                projectId,
                taskId,
                assignmentId,
                status
              )
            }
            onPriorityChange={(taskId, priority) =>
              updateTaskPriority(projectId, taskId, priority)
            }
            onDelete={(taskId) => deleteTask(projectId, taskId)}
            onEdit={openEdit}
            onArchive={(taskId, closeAs) =>
              archiveTask(projectId, taskId, closeAs)
            }
            onUnarchive={(taskId) => unarchiveTask(projectId, taskId)}
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
        isOwner={isOwner || isAdmin}
      />
    </Card>
  )
}
