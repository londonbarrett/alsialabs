"use client"

import type { Project } from "@/lib/types"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { projectsReducer } from "./projects-reducer"
import { createContext, useContext } from "react"

export function createProjectsStore(projects: Project[]) {
  const store = createOptimisticStore(projects, projectsReducer)
  return Object.assign(store, {
    getProjects: () => store((s) => s.optimistic),
    getPending: () => store((s) => s.pending),
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
