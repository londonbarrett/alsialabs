"use client"

import type { Project } from "@/lib/types"
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
  projects: Project[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createProjectsStore(projects))

  return (
    <ProjectsStoreContext value={store}>
      {children}
    </ProjectsStoreContext>
  )
}
