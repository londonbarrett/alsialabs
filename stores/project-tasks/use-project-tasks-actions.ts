"use client"

import type { TaskFormValues } from "@/components/projects/task-dialog"
import { useSettle } from "@/hooks/use-settle"
import {
  createComment,
  deleteComment as deleteCommentAction,
  getTaskComments,
  updateComment as updateCommentAction,
} from "@/lib/actions/task-comments"
import {
  createTask,
  deleteTask as deleteTaskAction,
  updateTask,
  updateTaskPriority as updateTaskPriorityAction,
  updateTaskStatus as updateTaskStatusAction,
} from "@/lib/actions/tasks"
import type { Task, TaskPriority, TaskStatus } from "@/lib/drizzle/schema"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"
import type {
  TaskWithCommentCount,
} from "./project-tasks-reducer"
import { useProjectTasksStore } from "./project-tasks-store"

/** `updateTaskStatus` is built from `sessionAction`, so its data is untyped. */
type StatusResultData = { nextTask?: Task }

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

  const { executeAsync: executeCreate } = useAction(createTask)
  const { executeAsync: executeUpdate } = useAction(updateTask)
  const { executeAsync: executeDelete } = useAction(deleteTaskAction)
  const { executeAsync: executeStatus } = useAction(updateTaskStatusAction)
  const { executeAsync: executePriority } =
    useAction(updateTaskPriorityAction)

  /** Fetch, not mutation: pends and commits directly so no loading bar. */
  const loadComments = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        const comments = await getTaskComments(taskId)
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

  async function saveTask({
    projectId,
    values,
    optimisticTask,
    editingTaskId,
  }: {
    projectId: string
    values: TaskFormValues
    optimisticTask: TaskWithCommentCount
    editingTaskId: string | null
  }) {
    const isEdit = editingTaskId !== null
    const payload = {
      projectId,
      name: values.name,
      description: values.description,
      cost: values.cost,
      status: values.status as TaskStatus,
      priority: values.priority as TaskPriority,
      dueDate: values.dueDate,
      assigneeId: values.assigneeId,
    }

    const result = await run(
      { type: isEdit ? "updateTask" : "addTask", task: optimisticTask },
      () =>
        isEdit
          ? executeUpdate({ ...payload, taskId: editingTaskId })
          : executeCreate(payload),
      {
        commitAction: (r) => ({
          type: "replaceTempTask",
          tempId: optimisticTask.id,
          task: {
            // `createTask`/`updateTask` destructure a single `.returning()`
            // row, so the action's data type is not a complete task.
            ...(r.data as Task),
            assigneeName: optimisticTask.assigneeName,
            commentCount: optimisticTask.commentCount,
          },
        }),
      }
    )
    settle(
      result,
      isEdit
        ? t("projects.tasks.taskUpdated")
        : t("projects.tasks.taskCreated")
    )
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
          const nextTask = (r?.data as StatusResultData | undefined)
            ?.nextTask
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
    const nextTask = (result?.data as StatusResultData | undefined)?.nextTask
    if (nextTask) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
  }

  async function updateTaskPriority(
    projectId: string,
    taskId: string,
    priority: TaskPriority
  ) {
    const result = await run(
      { type: "updateTaskPriority", taskId, priority },
      () => executePriority({ projectId, taskId, priority })
    )
    settle(result, t("projects.tasks.priorityChanged"))
  }

  async function addComment(
    taskId: string,
    content: string,
    authorId: string
  ) {
    // `getTaskComments` only returns the author of each existing comment, so
    // reuse it for the optimistic row rather than threading the user's profile.
    const existing = store
      .getState()
      .optimistic.commentsByTask[taskId]
      ?.find((c) => c.authorId === authorId)

    const tempComment: TaskCommentWithAuthor = {
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
      { type: "addComment", taskId, comment: tempComment },
      () => createComment(taskId, content),
      {
        commitAction: (r) =>
          r.success
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

  async function editComment(
    taskId: string,
    commentId: string,
    content: string
  ) {
    const result = await run(
      { type: "updateComment", taskId, commentId, content },
      () => updateCommentAction(commentId, taskId, content)
    )
    settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function deleteComment(taskId: string, commentId: string) {
    const result = await run(
      { type: "deleteComment", taskId, commentId },
      () => deleteCommentAction(commentId, taskId)
    )
    settle(result, t("projects.tasks.comments.commentDeleted"))
  }

  return {
    loadComments,
    saveTask,
    deleteTask,
    updateTaskStatus,
    updateTaskPriority,
    addComment,
    editComment,
    deleteComment,
  }
}