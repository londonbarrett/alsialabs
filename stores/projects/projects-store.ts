"use client"

import type { ProjectSummaryDTO } from "@/actions/schemas/project"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { projectsReducer } from "./projects-reducer"

export function createProjectsStore(projects: ProjectSummaryDTO[]) {
  /**
   * The whole state is the server's slice, so a reseed replaces it.
   */
  return createOptimisticStore({
    initialState: projects,
    reducer: projectsReducer,
  })
}

type ProjectsStore = ReturnType<typeof createProjectsStore>

export const ProjectsStoreContext = createContext<ProjectsStore | null>(
  null
)

export function useProjectsStore(): ProjectsStore {
  const store = useContext(ProjectsStoreContext)
  if (!store) {
    throw new Error(
      "useProjectsStore must be used within a ProjectsProvider"
    )
  }
  return store
}
