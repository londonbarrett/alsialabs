"use client"

import type { ProjectContextDTO } from "@/actions/projects/schemas"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type { ProjectContextAction } from "./project-context-reducer"
import { useProjectContextStore } from "./project-context-store"

type StoreType = OptimisticStore<ProjectContextDTO, ProjectContextAction>

export function useProjectContextState() {
  const store = useProjectContextStore()
  const context = useStore(store, (s: StoreType) => s.optimistic)

  const { project, members, categories, currentRole, currentUserId } =
    context

  return {
    project,
    projectId: project.id,
    members,
    categories,
    currentRole,
    currentUserId,
    isOwner: currentRole === "owner",
    isAdmin: currentRole === "admin",
    isCollaborator: currentRole === "collaborator",
  }
}
