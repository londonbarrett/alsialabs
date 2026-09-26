"use client"

import { useOptimisticDerived } from "@/hooks/use-optimistic-store"
import type {
  ProjectCategoryOption,
  ProjectDetail,
} from "@/lib/actions/projects"
import type { ProjectMember } from "@/lib/types"
import {
  applyProjectContextAction,
  useProjectContextStore,
} from "@/stores/project-context-store"
import { useMemo } from "react"

export interface ProjectContextValue {
  project: ProjectDetail
  /** The open project's id, exposed so leaves can target the project without a
   * `projectId` prop that could drift from the row on screen. */
  projectId: string
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  members: ProjectMember[]
  permissions: string[]
  categories: ProjectCategoryOption[]
  currentUserId: string
  isOwner: boolean
  isPrimaryOwner: boolean
  isCollaborator: boolean
  canEdit: boolean
  canDelete: boolean
  canManageUsers: boolean
}

/**
 * Global access to the open project's context. Must be called under a
 * `ProjectContextProvider`, which owns the store instance.
 */
export function useProjectContext(): ProjectContextValue {
  const context = useOptimisticDerived(
    useProjectContextStore(),
    applyProjectContextAction
  )

  const project = context.project
  const owners = context.owners
  const collaborators = context.collaborators
  const permissions = context.permissions
  const categories = context.categories
  const isCurrentUserAdmin = context.isCurrentUserAdmin
  const currentUserId = context.session?.user?.id ?? ""

  const members = useMemo(
    () => [...owners, ...collaborators],
    [owners, collaborators]
  )

  // `isOwner` already folds in `isCurrentUserAdmin`, so the subpages' original
  // `(isOwner || isCurrentUserAdmin) && permissions.includes(...)` reduces here.
  const isOwner =
    owners.some((o) => o.userId === currentUserId) || isCurrentUserAdmin
  const isPrimaryOwner = project.primaryOwnerId === currentUserId
  const isCollaborator =
    !isOwner && collaborators.some((c) => c.userId === currentUserId)
  const canEdit = isOwner && permissions.includes("projects:edit")
  const canDelete = isPrimaryOwner || isCurrentUserAdmin
  const canManageUsers = isPrimaryOwner || isCurrentUserAdmin

  return {
    project,
    projectId: project.id,
    owners,
    collaborators,
    members,
    permissions,
    categories,
    currentUserId,
    isOwner,
    isPrimaryOwner,
    isCollaborator,
    canEdit,
    canDelete,
    canManageUsers,
  }
}
