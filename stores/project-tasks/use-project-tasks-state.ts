"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { useStore } from "zustand"
import {
  EMPTY_COMMENTS,
  type ProjectTaskAction,
  type ProjectTasksState,
} from "./project-tasks-reducer"
import { useProjectTasksStore } from "./project-tasks-store"

type StoreType = OptimisticStore<ProjectTasksState, ProjectTaskAction>

export function useProjectTasksState() {
  const store = useProjectTasksStore()
  const tasks = useStore(store, (s: StoreType) => s.optimistic.tasks)
  const commentsByTask = useStore(
    store,
    (s: StoreType) => s.optimistic.commentsByTask
  )

  /** Stable empty list for a task whose comments have never been loaded. */
  function getComments(taskId: string): TaskCommentWithAuthor[] {
    return commentsByTask[taskId] ?? EMPTY_COMMENTS
  }

  return { tasks, getComments }
}