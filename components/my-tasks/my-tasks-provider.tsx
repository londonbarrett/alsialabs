"use client"

import type { MyAssignmentDTO } from "@/actions/tasks/schemas"
import { useServerReseed } from "@/hooks/use-server-reseed"
import {
  createMyTasksStore,
  MyTasksStoreContext,
} from "@/stores/my-tasks/my-tasks-store"
import { useState } from "react"

export function MyTasksProvider({
  assignments,
  children,
}: {
  /** The rows for the tab this page was rendered with. */
  assignments: MyAssignmentDTO[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createMyTasksStore({ assignments }))
  useServerReseed(store, assignments)

  return (
    <MyTasksStoreContext value={store}>{children}</MyTasksStoreContext>
  )
}
