"use client"

import type { ProjectContext } from "@/lib/actions/projects"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { projectContextReducer } from "@/stores/project-context-reducer"
import { createContext, useContext } from "react"

/**
 * The project currently open. Always present: the store is created by
 * `ProjectContextProvider` with the layout's context as its initial state, so
 * there is no empty first render and no way to read a stale project left over
 * from a previous route.
 *
 * Every mutation goes through an action here rather than relying on
 * `router.refresh()` to re-read the context — the store is seeded once per
 * provider mount, so a refresh does not rewrite it.
 */
export function createProjectContextStore(context: ProjectContext) {
  return createOptimisticStore(context, projectContextReducer)
}

type ProjectContextStore = ReturnType<typeof createProjectContextStore>

export const ProjectContextStoreContext =
  createContext<ProjectContextStore | null>(null)

export function useProjectContextStore(): ProjectContextStore {
  const store = useContext(ProjectContextStoreContext)
  if (!store) {
    throw new Error(
      "useProjectContextStore must be used within a ProjectContextProvider"
    )
  }
  return store
}
