"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import type { RoutineWithAssignee } from "@/lib/types"
import { useStore } from "zustand"
import type { RoutinesAction } from "./routines-reducer"
import { useRoutinesStore } from "./routines-store"

type StoreType = OptimisticStore<RoutineWithAssignee[], RoutinesAction>

export function useRoutinesState() {
  const store = useRoutinesStore()
  const routines = useStore(store, (s: StoreType) => s.optimistic)

  return { routines }
}
