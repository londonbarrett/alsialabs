import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { myTasksReducer, type MyTasksSeed } from "./my-tasks-reducer"

export function createMyTasksStore(seed: MyTasksSeed) {
  /**
   * `assignments` is the server's slice: the rows for the tab the page seeded.
   * `commentsByTask` is not — comments load per task when the panel opens, so
   * a reseed keeps them rather than making the open panel reload. Switching
   * tabs reseeds the list with the other view's rows.
   */
  return createOptimisticStore({
    initialState: { ...seed, commentsByTask: {} },
    reducer: myTasksReducer,
    serverSlice: "assignments",
  })
}

type MyTasksStore = ReturnType<typeof createMyTasksStore>

export const MyTasksStoreContext = createContext<MyTasksStore | null>(
  null
)

export function useMyTasksStore(): MyTasksStore {
  const store = useContext(MyTasksStoreContext)
  if (!store) {
    throw new Error(
      "useMyTasksStore must be used within a MyTasksProvider"
    )
  }
  return store
}
