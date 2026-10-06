import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import type { MyTask } from "@/lib/actions/tasks"
import {
  myTasksReducer,
  type MyTaskAction,
  type MyTasksState,
} from "./my-tasks-reducer"

export function createMyTasksStore(tasks: MyTask[]) {
  /**
   * `tasks` is the server's slice. `commentsByTask` is not: comments load per
   * task when the panel opens, so a reseed keeps them rather than making the
   * open panel reload. `getMyTasks({})` always seeds the full, unfiltered set,
   * so a fresh seed is a valid base for whatever filters are active.
   */
  return createOptimisticStore<MyTasksState, MyTaskAction, MyTask[]>(
    // Comments load per task when the panel opens, so nothing is seeded here.
    { tasks, commentsByTask: {} },
    myTasksReducer,
    (committed, next) => ({ ...committed, tasks: next })
  )
}

type MyTasksStore = ReturnType<typeof createMyTasksStore>

export const MyTasksStoreContext = createContext<MyTasksStore | null>(null)

export function useMyTasksStore(): MyTasksStore {
  const store = useContext(MyTasksStoreContext)
  if (!store) {
    throw new Error("useMyTasksStore must be used within a MyTasksProvider")
  }
  return store
}
