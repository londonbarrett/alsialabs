"use client"

import {
  type TaskPriorityDTO,
  type TaskStatus,
  type TaskWithAssignmentsDTO,
} from "@/actions/schemas/task"
import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"
import {
  createComment as createCommentAction,
  deleteComment as deleteCommentAction,
  getTaskComments,
  updateComment as updateCommentAction,
} from "@/actions/task-comments"
import {
  createTask as createTaskAction,
  deleteTask as deleteTaskAction,
  updateAssignmentComment as updateAssignmentCommentAction,
  updateAssignmentStatus as updateAssignmentStatusAction,
  updateTask as updateTaskAction,
  updateTaskPriority as updateTaskPriorityAction,
} from "@/actions/tasks"
import type { TaskFormValues } from "@/components/projects/task-dialog"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"
import { useProjectTasksStore } from "./project-tasks-store"

function toTaskPayload(
  projectId: string,
  values: TaskFormValues
) {
  return {
    projectId,
    name: values.name,
    description: values.description,
    priority: values.priority as TaskPriorityDTO,
    assigneeIds: values.assigneeIds,
    startDate: values.startDate,
    endDate: values.endDate,
    recurrence: values.recurrence,
    interval: values.interval,
    daysOfWeek: values.daysOfWeek,
    startTime: values.startTime,
    endTime: values.endTime,
    cost: values.cost,
  }
}

export function useProjectTasksActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useProjectTasksStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createTaskAction)
  const { executeAsync: executeUpdate } = useAction(updateTaskAction)
  const { executeAsync: executeDelete } = useAction(deleteTaskAction)
  const { executeAsync: executeStatus } = useAction(
    updateAssignmentStatusAction
  )
  const { executeAsync: executeComment } = useAction(
    updateAssignmentCommentAction
  )
  const { executeAsync: executePriority } = useAction(
    updateTaskPriorityAction
  )

  const loadComments = useCallback(
    async (projectId: string, taskId: string): Promise<void> => {
      try {
        const result = await getTaskComments({ projectId, taskId })
        const comments = result.data ?? []
        const id = store
          .getState()
          .pend({ type: "setComments", taskId, comments })
        store.getState().commit(id)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.somethingWentWrong")
        )
      }
    },
    [store, t]
  )

  async function createTask({
    projectId,
    values,
    optimisticTask,
  }: {
    projectId: string
    values: TaskFormValues
    optimisticTask: TaskWithAssignmentsDTO
  }) {
    const result = await run(
      { type: "addTask", task: optimisticTask },
      () => executeCreate(toTaskPayload(projectId, values)),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempTask",
                tempId: optimisticTask.id,
                task: {
                  ...r.data,
                  commentCount: optimisticTask.commentCount,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.taskCreated"))
  }

  async function updateTask({
    projectId,
    taskId,
    values,
    optimisticTask,
  }: {
    projectId: string
    taskId: string
    values: TaskFormValues
    optimisticTask: TaskWithAssignmentsDTO
  }) {
    const result = await run(
      { type: "updateTask", task: optimisticTask },
      () =>
        executeUpdate({ ...toTaskPayload(projectId, values), taskId }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempTask",
                tempId: optimisticTask.id,
                task: {
                  ...r.data,
                  commentCount: optimisticTask.commentCount,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.taskUpdated"))
  }

  async function deleteTask(projectId: string, taskId: string) {
    const result = await run({ type: "deleteTask", taskId }, () =>
      executeDelete({ projectId, taskId })
    )
    settle(result, t("projects.tasks.taskDeleted"))
  }

  async function updateAssignmentStatus(
    projectId: string,
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) {
    const current = store
      .getState()
      .optimistic.tasks.find((task) => task.id === taskId)
      ?.assignments.find((a) => a.id === assignmentId)
    if (!current) return

    const result = await run(
      {
        type: "upsertAssignment",
        taskId,
        assignment: { ...current, status },
      },
      () => executeStatus({ projectId, assignmentId, status }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "upsertAssignment",
                taskId,
                assignment: r.data.assignment,
                nextAssignment: r.data.nextAssignment,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.statusChanged"))
    if (result?.data?.nextAssignment) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
  }

  async function updateAssignmentComment(
    projectId: string,
    taskId: string,
    assignmentId: string,
    comment: string
  ) {
    const current = store
      .getState()
      .optimistic.tasks.find((task) => task.id === taskId)
      ?.assignments.find((a) => a.id === assignmentId)
    if (!current) return

    const result = await run(
      {
        type: "upsertAssignment",
        taskId,
        assignment: {
          ...current,
          comment: comment.trim() || null,
        },
      },
      () => executeComment({ projectId, assignmentId, comment }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "upsertAssignment",
                taskId,
                assignment: r.data,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function updateTaskPriority(
    projectId: string,
    taskId: string,
    priority: TaskPriorityDTO
  ) {
    const result = await run(
      { type: "updateTaskPriority", taskId, priority },
      () => executePriority({ projectId, taskId, priority })
    )
    settle(result, t("projects.tasks.priorityChanged"))
  }

  async function createComment(
    projectId: string,
    taskId: string,
    content: string,
    authorId: string
  ) {
    const existing = store
      .getState()
      .optimistic.commentsByTask[
        taskId
      ]?.find((c) => c.authorId === authorId)

    const tempComment: TaskCommentWithAuthorDTO = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId,
      authorName: existing?.authorName ?? null,
      authorImage: existing?.authorImage ?? null,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await run(
      { type: "createComment", taskId, comment: tempComment },
      () => createCommentAction({ projectId, taskId, content }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempComment" as const,
                taskId,
                tempId: tempComment.id,
                comment: r.data.comment,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.comments.commentAdded"))
  }

  async function updateComment(
    projectId: string,
    taskId: string,
    commentId: string,
    content: string
  ) {
    const result = await run(
      { type: "updateComment", taskId, commentId, content },
      () =>
        updateCommentAction({ projectId, commentId, taskId, content })
    )
    settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function deleteComment(
    projectId: string,
    taskId: string,
    commentId: string
  ) {
    const result = await run(
      { type: "deleteComment", taskId, commentId },
      () => deleteCommentAction({ projectId, commentId, taskId })
    )
    settle(result, t("projects.tasks.comments.commentDeleted"))
  }

  return {
    loadComments,
    createTask,
    updateTask,
    deleteTask,
    updateAssignmentStatus,
    updateAssignmentComment,
    updateTaskPriority,
    createComment,
    updateComment,
    deleteComment,
  }
}
