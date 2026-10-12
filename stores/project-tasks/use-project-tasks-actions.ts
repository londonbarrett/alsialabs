"use client"

import {
  type TaskPriorityDTO,
  type TaskStatus,
  type TaskWithCommentCountDTO,
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
  updateTask as updateTaskAction,
  updateTaskPriority as updateTaskPriorityAction,
  updateTaskStatus as updateTaskStatusAction,
} from "@/actions/tasks"
import type { TaskFormValues } from "@/components/projects/task-dialog"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"
import { useProjectTasksStore } from "./project-tasks-store"

function toTaskPayload(projectId: string, values: TaskFormValues) {
  return {
    projectId,
    name: values.name,
    description: values.description,
    cost: values.cost,
    status: values.status as TaskStatus,
    priority: values.priority as TaskPriorityDTO,
    dueDate: values.dueDate,
    assigneeId: values.assigneeId,
  }
}

/**
 * Every project-task and project-task-comment mutation, so `tasks-card` and
 * `project-task-comments-panel` never import the actions directly. Runs
 * through the project tasks store (`ProjectTasksProvider`).
 *
 * `projectId` is a parameter rather than read from `useProjectContextState`,
 * because no store folder may import a sibling store folder. The seeded
 * `assigneeName` on the optimistic row is carried through to the authoritative
 * row, which also preserves `commentCount`: the task actions return a hardcoded
 * `0`, so trusting them would wipe the count on every edit.
 */
export function useProjectTasksActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useProjectTasksStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createTaskAction)
  const { executeAsync: executeUpdate } = useAction(updateTaskAction)
  const { executeAsync: executeDelete } = useAction(deleteTaskAction)
  const { executeAsync: executeStatus } = useAction(
    updateTaskStatusAction
  )
  const { executeAsync: executePriority } = useAction(
    updateTaskPriorityAction
  )

  /** Fetch, not mutation: pends and commits directly so no loading bar. */
  const loadComments = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        const result = await getTaskComments({ taskId })
        const comments = result.data ?? []
        const id = store
          .getState()
          .pend({ type: "setComments", taskId, comments })
        store.getState().commit(id)
      } catch (error) {
        // `getTaskComments` throws an already-translated message.
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
    optimisticTask: TaskWithCommentCountDTO
  }) {
    const result = await run(
      { type: "addTask", task: optimisticTask },
      () => executeCreate(toTaskPayload(projectId, values)),
      {
        commitAction: (r) => ({
          type: "replaceTempTask",
          tempId: optimisticTask.id,
          task: r.data
            ? {
                ...r.data,
                assigneeName: optimisticTask.assigneeName,
                commentCount: optimisticTask.commentCount,
              }
            : optimisticTask,
        }),
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
    optimisticTask: TaskWithCommentCountDTO
  }) {
    const result = await run(
      { type: "updateTask", task: optimisticTask },
      () =>
        executeUpdate({ ...toTaskPayload(projectId, values), taskId }),
      {
        commitAction: (r) => ({
          type: "replaceTempTask",
          tempId: optimisticTask.id,
          task: r.data
            ? {
                ...r.data,
                assigneeName: optimisticTask.assigneeName,
                commentCount: optimisticTask.commentCount,
              }
            : optimisticTask,
        }),
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

  async function updateTaskStatus(
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) {
    const changed = store
      .getState()
      .optimistic.tasks.find((t) => t.id === taskId)

    const result = await run(
      { type: "updateTaskStatus", taskId, status },
      () => executeStatus({ projectId, taskId, status }),
      {
        // Completing a recurring task can spawn its next occurrence.
        commitAction: (r) => {
          const nextTask = r?.data?.nextTask
          if (!nextTask) return undefined
          return {
            type: "addTask" as const,
            task: {
              ...nextTask,
              assigneeName: changed?.assigneeName ?? null,
              commentCount: 0,
            },
          }
        },
      }
    )
    settle(result, t("projects.tasks.statusChanged"))
    const nextTask = result?.data?.nextTask
    if (nextTask) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
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
    taskId: string,
    content: string,
    authorId: string
  ) {
    // `getTaskComments` only returns the author of each existing comment, so
    // reuse it for the optimistic row rather than threading the user's profile.
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
      () => createCommentAction({ taskId, content }),
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
    taskId: string,
    commentId: string,
    content: string
  ) {
    const result = await run(
      { type: "updateComment", taskId, commentId, content },
      () => updateCommentAction({ commentId, taskId, content })
    )
    settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function deleteComment(taskId: string, commentId: string) {
    const result = await run(
      { type: "deleteComment", taskId, commentId },
      () => deleteCommentAction({ commentId, taskId })
    )
    settle(result, t("projects.tasks.comments.commentDeleted"))
  }

  return {
    loadComments,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskPriority,
    createComment,
    updateComment,
    deleteComment,
  }
}
