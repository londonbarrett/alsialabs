"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { MyTask } from "@/lib/actions/tasks"
import { useState } from "react"
import {
  createMyTasksStore,
  MyTasksStoreContext,
} from "@/stores/my-tasks/my-tasks-store"

export function MyTasksProvider({
  tasks,
  children,
}: {
  tasks: MyTask[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createMyTasksStore(tasks))
  useServerReseed(store, tasks)

  return (
    <MyTasksStoreContext value={store}>{children}</MyTasksStoreContext>
  )
}
