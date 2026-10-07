"use client"

import type { ProjectContext } from "@/lib/actions/projects"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { projectContextReducer } from "./project-context-reducer"
import { createContext, useContext } from "react"

/**
 * The project currently open. Always present: the store is created by
 * `ProjectContextProvider` with the layout's context as its initial state, so
 * there is no empty first render and no way to read a stale project left over
 * from a previous route.
 *
 * Mutations still go through actions here; `router.refresh()` only re-reads the
 * context once `useServerReseed` hands the provider a fresh `context` prop and
 * the store adopts it through `reseedFromServer`, since the store is seeded
 * once per provider mount and a refresh alone would not rewrite it. Any pending
 * action survives that, so an in-flight optimistic edit is not lost when the
 * context is refreshed.
 */
export function createProjectContextStore(context: ProjectContext) {
  /**
   * The whole state is the server's slice, so a reseed replaces it.
   */
  return createOptimisticStore({
    initialState: context,
    reducer: projectContextReducer,
  })
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
