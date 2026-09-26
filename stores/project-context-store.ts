"use client"

import type {
  ProjectContext,
  ProjectDetail,
  ProjectOwner,
} from "@/lib/actions/projects"
import { createOptimisticStore } from "@/lib/optimistic-store"
import type { ProjectMember } from "@/lib/types"
import { createContext, useContext } from "react"

/**
 * The project currently open. Always present: the store is created by
 * `ProjectContextProvider` with the layout's context as its initial state, so
 * there is no "not hydrated yet" phase and no way to read a stale project left
 * over from a previous route.
 *
 * Every mutation goes through an action here rather than relying on
 * `router.refresh()` to re-read the context — the store is seeded once per
 * provider mount, so a refresh does not rewrite it.
 */
export type ProjectContextAction =
  | { type: "patchProject"; patch: Partial<ProjectDetail> }
  | { type: "addOwner"; member: ProjectOwner }
  | { type: "addCollaborator"; member: ProjectMember }
  | { type: "removeMember"; userId: string }

// TODO: Project Context should be read only, refactor when all other stores are done
export function projectContextReducer(
  state: ProjectContext,
  action: ProjectContextAction
): ProjectContext {
  switch (action.type) {
    case "patchProject":
      return {
        ...state,
        project: { ...state.project, ...action.patch },
      }
    case "addOwner":
      if (state.owners.some((o) => o.userId === action.member.userId))
        return state
      return { ...state, owners: [...state.owners, action.member] }
    case "addCollaborator":
      if (
        state.collaborators.some(
          (c) => c.userId === action.member.userId
        )
      )
        return state
      return {
        ...state,
        collaborators: [...state.collaborators, action.member],
      }
    case "removeMember": {
      const owners = state.owners.filter(
        (o) => o.userId !== action.userId
      )
      const collaborators = state.collaborators.filter(
        (c) => c.userId !== action.userId
      )
      if (
        owners.length === state.owners.length &&
        collaborators.length === state.collaborators.length
      )
        return state
      return { ...state, owners, collaborators }
    }
  }
}

/** Adapts the reducer to the generic store's `(state, key, action)` signature,
 * which it ignores — there is only ever one project. */
export function applyProjectContextAction(
  state: ProjectContext,
  _key: string | undefined,
  action: ProjectContextAction
): ProjectContext {
  return projectContextReducer(state, action)
}

export function createProjectContextStore(context: ProjectContext) {
  return createOptimisticStore(context, applyProjectContextAction)
}

export type ProjectContextStore = ReturnType<
  typeof createProjectContextStore
>

export const ProjectContextStoreContext =
  createContext<ProjectContextStore | null>(null)

export function useProjectContextStore(): ProjectContextStore {
  const store = useContext(ProjectContextStoreContext)
  if (!store) {
    throw new Error(
      "useProjectContext must be used within a ProjectContextProvider"
    )
  }
  return store
}
