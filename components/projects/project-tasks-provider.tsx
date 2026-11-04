"use client"

import {
  createProjectTasksStore,
  ProjectTasksStoreContext,
} from "@/stores/project-tasks/project-tasks-store"
import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { useServerReseed } from "@/hooks/use-server-reseed"
import { useState } from "react"

export function ProjectTasksProvider({
  tasks,
  children,
}: {
  tasks: TaskWithAssignmentsDTO[]
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
