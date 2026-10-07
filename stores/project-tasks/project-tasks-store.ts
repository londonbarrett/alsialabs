import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import {
  projectTasksReducer,
  type TaskWithCommentCount,
} from "./project-tasks-reducer"

export function createProjectTasksStore(tasks: TaskWithCommentCount[]) {
  /**
   * `tasks` is the server's slice. `commentsByTask` is not: comments load per
   * task when the panel opens, so a reseed keeps them rather than making the
   * open panel reload.
   */
  return createOptimisticStore({
    // Comments load per task when the panel opens, so nothing is seeded here.
    initialState: { tasks, commentsByTask: {} },
    reducer: projectTasksReducer,
    serverSlice: "tasks",
  })
}

type ProjectTasksStore = ReturnType<typeof createProjectTasksStore>

export const ProjectTasksStoreContext =
  createContext<ProjectTasksStore | null>(null)

export function useProjectTasksStore(): ProjectTasksStore {
  const store = useContext(ProjectTasksStoreContext)
  if (!store) {
    throw new Error(
      "useProjectTasksStore must be used within a ProjectTasksProvider"
    )
  }
  return store
}