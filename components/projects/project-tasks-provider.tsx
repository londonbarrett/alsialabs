"use client"

import {
  createProjectTasksStore,
  ProjectTasksStoreContext,
} from "@/stores/project-tasks/project-tasks-store"
import type { TaskWithCommentCount } from "@/stores/project-tasks/project-tasks-reducer"
import { useServerReseed } from "@/hooks/use-server-reseed"
import { useState } from "react"

export function ProjectTasksProvider({
  tasks,
  children,
}: {
  tasks: TaskWithCommentCount[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createProjectTasksStore(tasks))
  useServerReseed(store, tasks)

  return (
    <ProjectTasksStoreContext value={store}>
      {children}
    </ProjectTasksStoreContext>
  )
}
