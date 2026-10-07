"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { RoutineWithAssignee } from "@/lib/types"
import { useState } from "react"
import {
  createRoutinesStore,
  RoutinesStoreContext,
} from "@/stores/routines/routines-store"

export function RoutinesProvider({
  routines,
  children,
}: {
  routines: RoutineWithAssignee[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createRoutinesStore(routines))
  useServerReseed(store, routines)

  return (
    <RoutinesStoreContext value={store}>{children}</RoutinesStoreContext>
  )
}
