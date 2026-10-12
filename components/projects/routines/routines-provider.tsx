"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { RoutineWithAssigneeDTO } from "@/actions/schemas/routine"
import { useState } from "react"
import {
  createRoutinesStore,
  RoutinesStoreContext,
} from "@/stores/routines/routines-store"

export function RoutinesProvider({
  routines,
  children,
}: {
  routines: RoutineWithAssigneeDTO[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createRoutinesStore(routines))
  useServerReseed(store, routines)

  return (
    <RoutinesStoreContext value={store}>
      {children}
    </RoutinesStoreContext>
  )
}
