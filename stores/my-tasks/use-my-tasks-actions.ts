"use client"

import { useSettle } from "@/hooks/use-settle"
import {
  createComment as createCommentAction,
  deleteComment as deleteCommentAction,
  getTaskComments,
  updateComment as updateCommentAction,
} from "@/actions/task-comments"
import { updateTaskStatus as updateTaskStatusAction } from "@/actions/tasks"
import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useAction } from "next-safe-action/hooks"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { toast } from "sonner"
import { useMyTasksStore } from "./my-tasks-store"

/** `updateTaskStatus` is built from `sessionAction`, so its data is untyped. */
type StatusResultData = { nextTask?: Task }

/**
 * Every my-task and my-task-comment mutation, so `MyTasksList` and
 * `MyTaskCommentsPanel` never import the server actions directly. Runs through
 * the my tasks store (`MyTasksProvider`).
 *
 * `projectId` is an explicit parameter rather than read from a context, so the
 * store folder stays free of sibling-store imports.
 */
export function useMyTasksActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useMyTasksStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeStatus } = useAction(
    updateTaskStatusAction
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

  async function updateTaskStatus(
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) {
    const result = await run(
      { type: "updateTaskStatus", taskId, status },
      () => executeStatus({ projectId, taskId, status }),
      {
        // Completing a recurring task can spawn its next occurrence.
        commitAction: (r) => {
          const nextTask = (r?.data as StatusResultData | undefined)
            ?.nextTask
          if (!nextTask) return undefined
          return { type: "addNextTask", sourceTaskId: taskId, nextTask }
        },
      }
    )
    settle(result, t("projects.tasks.statusChanged"))
    const nextTask = (result?.data as StatusResultData | undefined)
      ?.nextTask
    if (nextTask) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
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
    updateTaskStatus,
    createComment,
    updateComment,
    deleteComment,
  }
}
