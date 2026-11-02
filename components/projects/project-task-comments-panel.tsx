"use client"

import type { TaskWithAssignmentsDTO } from "@/actions/schemas/task"
import { TaskCommentPanel } from "@/components/common/task-comment-panel"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useProjectTasksState } from "@/stores/project-tasks/use-project-tasks-state"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Project-tasks controller for `TaskCommentPanel`.
 *
 * Comments live in the project tasks store, so a mutation both writes the
 * comment and adjusts the task's `commentCount` through the same pending
 * action. `MyTaskCommentsPanel` is its own controller over the same sheet for
 * the my tasks store.
 */
export function ProjectTaskCommentsPanel({
  task,
  open,
  onOpenChange,
  currentUserId,
  isOwner,
}: {
  /**
   * Undefined only while the Sheet plays its close animation; the parent keeps
   * it mounted for ~300ms after clearing the selected task.
   */
  task?: TaskWithAssignmentsDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  isOwner: boolean
}) {
  const { projectId } = useProjectContextState()
  const { getComments } = useProjectTasksState()
  const { loadComments, createComment, updateComment, deleteComment } =
    useProjectTasksActions()
  const taskId = task?.id ?? ""
  const [loading, setLoading] = useState(false)
  const wasOpen = useRef(false)

  const refresh = useCallback(() => {
    if (!taskId) return
    setLoading(true)
    void loadComments(projectId, taskId).finally(() => setLoading(false))
  }, [loadComments, projectId, taskId])

  // Fetch on the open *transition* only. Depending on `refresh` alone would
  // refetch on every render, since the action hook is not referentially stable.
  useEffect(() => {
    if (open && !wasOpen.current) refresh()
    wasOpen.current = open
  }, [open, refresh])

  return (
    <TaskCommentPanel
      taskName={task?.name ?? ""}
      description={task?.description}
      comments={getComments(taskId)}
      loading={loading}
      currentUserId={currentUserId}
      canModerate={isOwner}
      open={open}
      onOpenChange={onOpenChange}
      onRefresh={refresh}
      onCreate={(content) => {
        if (taskId) createComment(projectId, taskId, content, currentUserId)
      }}
      onEdit={(commentId, content) => {
        if (taskId) updateComment(projectId, taskId, commentId, content)
      }}
      onDelete={(commentId) => {
        if (taskId) deleteComment(projectId, taskId, commentId)
      }}
    />
  )
}
