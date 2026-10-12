"use client"

import type { RoutineWithAssigneeDTO } from "@/actions/schemas/routine"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type { RoutinesAction } from "./routines-reducer"
import { useRoutinesStore } from "./routines-store"

type StoreType = OptimisticStore<
  RoutineWithAssigneeDTO[],
  RoutinesAction
>

export function useRoutinesState() {
  const store = useRoutinesStore()
  const routines = useStore(store, (s: StoreType) => s.optimistic)

  return { routines }
}
