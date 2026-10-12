"use client"

import type { MyTaskDTO } from "@/actions/schemas/task"
import { useServerReseed } from "@/hooks/use-server-reseed"
import {
  createMyTasksStore,
  MyTasksStoreContext,
} from "@/stores/my-tasks/my-tasks-store"
import { useState } from "react"

export function MyTasksProvider({
  tasks,
  children,
}: {
  tasks: MyTaskDTO[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createMyTasksStore(tasks))
  useServerReseed(store, tasks)

  return (
    <MyTasksStoreContext value={store}>{children}</MyTasksStoreContext>
  )
}
