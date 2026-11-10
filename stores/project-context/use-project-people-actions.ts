"use client"

import {
  addProjectAdmin,
  addProjectCollaborator,
  removeProjectAdmin,
  removeProjectCollaborator,
  setProjectMemberRole,
} from "@/actions/projects"
import type { ProjectMemberRowDTO } from "@/actions/projects/schemas"
import type { UserOptionDTO } from "@/actions/legacy/schemas/user"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useProjectContextStore } from "./project-context-store"
import { useProjectContextState } from "./use-project-context-state"

function toMember(
  user: UserOptionDTO,
  role: "admin" | "collaborator"
): ProjectMemberRowDTO {
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.image,
    role,
    isPrimaryOwner: false,
  }
}

/**
 * Membership mutations for the open project, through the context store so the
 * optimistic row appears before `router.refresh()` reseeds it.
 */
export function useProjectPeopleActions() {
  const t = useTranslations("projects")
  const settle = useSettle()
  const { projectId } = useProjectContextState()
  const { run } = useOptimisticAction(useProjectContextStore())

  const { executeAsync: executeAddAdmin } = useAction(addProjectAdmin)
  const { executeAsync: executeRemoveAdmin } =
    useAction(removeProjectAdmin)
  const { executeAsync: executeAddCollaborator } = useAction(
    addProjectCollaborator
  )
  const { executeAsync: executeRemoveCollaborator } = useAction(
    removeProjectCollaborator
  )
  const { executeAsync: executeSetRole } = useAction(
    setProjectMemberRole
  )

  async function addAdmin(user: UserOptionDTO) {
    const result = await run(
      { type: "addMember", member: toMember(user, "admin") },
      () => executeAddAdmin({ projectId, userId: user.id })
    )
    settle(result, t("ownerAdded"))
  }

  async function removeAdmin(userId: string) {
    const result = await run({ type: "removeMember", userId }, () =>
      executeRemoveAdmin({ projectId, userId })
    )
    settle(result, t("ownerRemoved"))
  }

  async function addCollaborator(user: UserOptionDTO) {
    const result = await run(
      { type: "addMember", member: toMember(user, "collaborator") },
      () => executeAddCollaborator({ projectId, userId: user.id })
    )
    settle(result, t("collaboratorAdded"))
  }

  async function removeCollaborator(userId: string) {
    const result = await run({ type: "removeMember", userId }, () =>
      executeRemoveCollaborator({ projectId, userId })
    )
    settle(result, t("collaboratorRemoved"))
  }

  async function setRole(
    userId: string,
    role: "admin" | "collaborator"
  ) {
    const result = await run(
      { type: "setMemberRole", userId, role },
      () => executeSetRole({ projectId, userId, role })
    )
    settle(result, t("projectUpdated"))
  }

  return {
    addAdmin,
    removeAdmin,
    addCollaborator,
    removeCollaborator,
    setRole,
  }
}
