"use client"

import type { ProjectContext } from "@/lib/actions/projects"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type { ProjectContextAction } from "./project-context-reducer"
import { useProjectContextStore } from "./project-context-store"

type StoreType = OptimisticStore<ProjectContext, ProjectContextAction>

export function useProjectContextState() {
  const store = useProjectContextStore()
  const context = useStore(store, (s: StoreType) => s.optimistic)

  const project = context.project
  const owners = context.owners
  const collaborators = context.collaborators
  const categories = context.categories
  const isCurrentUserAdmin = context.isCurrentUserAdmin
  const currentUserId = context.session?.user?.id ?? ""

  const members = [...owners, ...collaborators]
  const primaryOwner =
    owners.find((o) => o.userId === project.primaryOwnerId) ?? null
  const additionalOwners = owners.filter(
    (o) => o.userId !== project.primaryOwnerId
  )

  const isOwner =
    owners.some((o) => o.userId === currentUserId) || isCurrentUserAdmin
  const isPrimaryOwner = project.primaryOwnerId === currentUserId
  const isCollaborator =
    !isOwner && collaborators.some((c) => c.userId === currentUserId)

  return {
    project,
    projectId: project.id,
    owners,
    primaryOwner,
    additionalOwners,
    collaborators,
    members,
    categories,
    currentUserId,
    isCurrentUserAdmin,
    isOwner,
    isPrimaryOwner,
    isCollaborator,
  }
}
