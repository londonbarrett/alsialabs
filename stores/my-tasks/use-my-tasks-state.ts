"use client"

import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import {
  EMPTY_COMMENTS,
  type MyTaskAction,
  type MyTasksState,
} from "./my-tasks-reducer"
import { useMyTasksStore } from "./my-tasks-store"

type StoreType = OptimisticStore<MyTasksState, MyTaskAction>

export function useMyTasksState() {
  const store = useMyTasksStore()
  const tasks = useStore(store, (s: StoreType) => s.optimistic.tasks)
  const commentsByTask = useStore(
    store,
    (s: StoreType) => s.optimistic.commentsByTask
  )

  /** Stable empty list for a task whose comments have never been loaded. */
  function getComments(taskId: string): TaskCommentWithAuthorDTO[] {
    return commentsByTask[taskId] ?? EMPTY_COMMENTS
  }

  return { tasks, getComments }
}
