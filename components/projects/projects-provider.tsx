"use client"

import type { ProjectSummaryDTO } from "@/actions/schemas/project"
import { useServerReseed } from "@/hooks/use-server-reseed"
import {
  createProjectsStore,
  ProjectsStoreContext,
} from "@/stores/projects/projects-store"
import { useState } from "react"

/**
 * Provides the projects fetched by the list page to the projects subtree.
 * Navigating away remounts this provider, which builds a fresh store.
 */
export function ProjectsProvider({
  projects,
  children,
}: {
  projects: ProjectSummaryDTO[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createProjectsStore(projects))
  useServerReseed(store, projects)

  return (
    <ProjectsStoreContext value={store}>
      {children}
    </ProjectsStoreContext>
  )
}
