"use client"

import { TaskCommentPanel } from "@/components/common/task-comment-panel"
import { useMyTasksActions } from "@/stores/my-tasks/use-my-tasks-actions"
import { useMyTasksState } from "@/stores/my-tasks/use-my-tasks-state"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * my-tasks controller for `TaskCommentPanel`.
 *
 * Comments live in the my tasks store, so a mutation both writes the comment
 * and adjusts the task's `commentCount` through the same pending action —
 * a rejected comment rolls the count back with it, and nothing has to report a
 * delta upward through `MyTasksList`.
 */
export function MyTaskCommentsPanel({
  taskId,
  taskName,
  description,
  open,
  onOpenChange,
  currentUserId,
  isOwner,
}: {
  /**
   * Empty while the Sheet plays its close animation; the parent keeps it
   * mounted for ~300ms after clearing the selected task.
   */
  taskId: string
  taskName: string
  description?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  isOwner: boolean
}) {
  const { getComments } = useMyTasksState()
  const { loadComments, createComment, updateComment, deleteComment } =
    useMyTasksActions()
  const [loading, setLoading] = useState(false)
  const wasOpen = useRef(false)

  const refresh = useCallback(() => {
    if (!taskId) return
    setLoading(true)
    void loadComments(taskId).finally(() => setLoading(false))
  }, [loadComments, taskId])

  // Fetch on the open *transition* only. Depending on `refresh` alone would
  // refetch on every render, since the action hook is not referentially stable.
  useEffect(() => {
    if (open && !wasOpen.current) refresh()
    wasOpen.current = open
  }, [open, refresh])

  return (
    <TaskCommentPanel
      taskName={taskName}
      description={description}
      comments={getComments(taskId)}
      loading={loading}
      currentUserId={currentUserId}
      canModerate={isOwner}
      open={open}
      onOpenChange={onOpenChange}
      onRefresh={refresh}
      onCreate={(content) => {
        if (taskId) createComment(taskId, content, currentUserId)
      }}
      onEdit={(commentId, content) => {
        if (taskId) updateComment(taskId, commentId, content)
      }}
      onDelete={(commentId) => {
        if (taskId) deleteComment(taskId, commentId)
      }}
    />
  )
}
