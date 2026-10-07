import { createOptimisticStore } from "@/lib/optimistic-store"
import type { RoutineWithAssignee } from "@/lib/types"
import { createContext, useContext } from "react"
import { routinesReducer } from "./routines-reducer"

export function createRoutinesStore(
  routines: RoutineWithAssignee[]
) {
  /** The whole state is the server's slice, so a reseed replaces it. */
  return createOptimisticStore({
    initialState: routines,
    reducer: routinesReducer,
  })
}

type RoutinesStore = ReturnType<typeof createRoutinesStore>

export const RoutinesStoreContext = createContext<RoutinesStore | null>(
  null
)

export function useRoutinesStore(): RoutinesStore {
  const store = useContext(RoutinesStoreContext)
  if (!store) {
    throw new Error(
      "useRoutinesStore must be used within a RoutinesProvider"
    )
  }
  return store
}
