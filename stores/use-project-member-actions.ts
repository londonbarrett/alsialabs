"use client"

import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import type { ProjectOwner } from "@/lib/actions/projects"
import {
  addProjectCollaborator,
  addProjectOwner,
  removeProjectCollaborator,
  removeProjectOwner,
} from "@/lib/actions/project-users"
import type { UserOption } from "@/lib/actions/users"
import type { ProjectMember } from "@/lib/types"
import { useProjectContextStore } from "@/stores/project-context-store"
import { useProjectContext } from "@/stores/use-project-context"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

function toMember(user: UserOption): ProjectMember {
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.image,
  }
}

/** A newly added owner is never the primary one, so the row points at whoever
 * already holds it. */
function toOwner(
  user: UserOption,
  primaryOwnerId: string
): ProjectOwner {
  return { ...toMember(user), primaryOwnerId }
}

type MembershipResult = { success: boolean; error?: string }

// TODO: this should be stored on the members store, removed when complete
/**
 * Membership mutations for the open project.
 *
 * These go through the context store rather than `router.refresh()`: the store
 * is seeded once when the provider mounts, so a refresh would not bring the new
 * membership into client state. The user picked in the invite input carries the
 * details needed to render their pill immediately; if the server rejects the
 * change, the pending action is discarded and the pill reverts.
 */
export function useProjectMemberActions() {
  const t = useTranslations()
  const { project, projectId } = useProjectContext()
  const { run } = useOptimisticAction(useProjectContextStore())

  function reportError(result: MembershipResult) {
    toast.error(result.error || t("common.somethingWentWrong"))
  }

  async function addOwner(user: UserOption) {
    const result = await run<MembershipResult>(
      {
        type: "addOwner",
        member: toOwner(user, project.primaryOwnerId),
      },
      () => addProjectOwner(projectId, user.id)
    )
    if (!result?.success) reportError(result ?? { success: false })
    return result
  }

  async function removeOwner(userId: string) {
    const result = await run<MembershipResult>(
      { type: "removeMember", userId },
      () => removeProjectOwner(projectId, userId)
    )
    if (!result?.success) reportError(result ?? { success: false })
    return result
  }

  async function addCollaborator(user: UserOption) {
    const result = await run<MembershipResult>(
      { type: "addCollaborator", member: toMember(user) },
      () => addProjectCollaborator(projectId, user.id)
    )
    if (!result?.success) reportError(result ?? { success: false })
    return result
  }

  async function removeCollaborator(userId: string) {
    const result = await run<MembershipResult>(
      { type: "removeMember", userId },
      () => removeProjectCollaborator(projectId, userId)
    )
    if (!result?.success) reportError(result ?? { success: false })
    return result
  }

  return { addOwner, removeOwner, addCollaborator, removeCollaborator }
}
