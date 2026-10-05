"use client"

import { createOptimisticStore } from "@/lib/optimistic-store"
import type { Project } from "@/lib/types"
import { createContext, useContext } from "react"
import { projectsReducer } from "./projects-reducer"

export function createProjectsStore(projects: Project[]) {
  return createOptimisticStore(projects, projectsReducer)
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
