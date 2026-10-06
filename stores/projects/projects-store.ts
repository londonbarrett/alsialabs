"use client"

import { createOptimisticStore } from "@/lib/optimistic-store"
import type { Project } from "@/lib/types"
import { createContext, useContext } from "react"
import { projectsReducer, type ProjectsAction } from "./projects-reducer"

export function createProjectsStore(projects: Project[]) {
  /**
   * The whole state is the server's slice, so a reseed replaces it.
   */
  return createOptimisticStore<Project[], ProjectsAction, Project[]>(
    projects,
    projectsReducer,
    (_, next) => next
  )
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
