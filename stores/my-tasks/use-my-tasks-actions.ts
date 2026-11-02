"use client"

import type { TaskStatus } from "@/actions/schemas/task"
import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"
import {
  createComment as createCommentAction,
  deleteComment as deleteCommentAction,
  getTaskComments,
  updateComment as updateCommentAction,
} from "@/actions/task-comments"
import { updateAssignmentStatus as updateAssignmentStatusAction } from "@/actions/tasks"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"
import { useMyTasksStore } from "./my-tasks-store"

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
    updateAssignmentStatusAction
  )

  /** Fetch, not mutation: pends and commits directly so no loading bar. */
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

  async function updateAssignment(
    projectId: string,
    assignmentId: string,
    status: TaskStatus
  ) {
    const state = store.getState().optimistic
    const current = state.assignments.find(
      (assignment) => assignment.assignmentId === assignmentId
    )
    if (!current) return

    const result = await run(
      { type: "updateAssignment", assignmentId, status },
      () => executeStatus({ projectId, assignmentId, status }),
      {
        // Completing a recurring assignment can spawn its next occurrence;
        // the source row already left the list, so it rides along here.
        commitAction: (r) => {
          const nextAssignment = r?.data?.nextAssignment
          if (!nextAssignment) return undefined
          return {
            type: "insertNextAssignment",
            source: current,
            assignment: nextAssignment,
          }
        },
      }
    )
    settle(result, t("projects.tasks.statusChanged"))
    if (result?.data?.nextAssignment) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
  }

  async function createComment(
    projectId: string,
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
      () =>
        deleteCommentAction({ projectId, commentId, taskId })
    )
    settle(result, t("projects.tasks.comments.commentDeleted"))
  }

  return {
    loadComments,
    updateAssignment,
    createComment,
    updateComment,
    deleteComment,
  }
}
