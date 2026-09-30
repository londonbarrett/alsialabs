"use client"

import { createOptimisticStore } from "@/lib/optimistic-store"
import type { Project } from "@/lib/types"
import { createContext, useContext } from "react"

export type ProjectsAction =
  | { type: "add"; project: Project }
  | { type: "replaceTemp"; tempId: string; project: Project }

let nextOptimisticId = 1

export function nextOptimisticProjectId(): string {
  return `optimistic-${nextOptimisticId++}`
}

export function projectsReducer(
  state: Project[],
  action: ProjectsAction
): Project[] {
  switch (action.type) {
    case "add":
      return [action.project, ...state]
    case "replaceTemp":
      return state.map((p) =>
        p.id === action.tempId ? action.project : p
      )
  }
}

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
