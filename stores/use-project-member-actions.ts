"use client"

import { useOptimisticAction } from "@/stores/use-optimistic-action"
import {
  addProjectCollaborator,
  addProjectOwner,
  removeProjectCollaborator,
  removeProjectOwner,
} from "@/lib/actions/project-people"
import type { ProjectOwner } from "@/lib/actions/projects"
import type { UserOption } from "@/lib/actions/users"
import type { ProjectMember } from "@/lib/types"
import { useActionError } from "@/lib/util/action-errors"
import { useProjectContextStore } from "@/stores/project-context-store"
import { useProjectContext } from "@/stores/use-project-context"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
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
  const t = useTranslations("projects")
  const translateError = useActionError()
  const { project, projectId } = useProjectContext()
  const { run } = useOptimisticAction(useProjectContextStore())

  const { executeAsync: executeAddOwner } = useAction(addProjectOwner)
  const { executeAsync: executeRemoveOwner } =
    useAction(removeProjectOwner)
  const { executeAsync: executeAddCollaborator } = useAction(
    addProjectCollaborator
  )
  const { executeAsync: executeRemoveCollaborator } = useAction(
    removeProjectCollaborator
  )

  function reportError(result: { serverError: { code: string } }) {
    toast.error(translateError(result.serverError.code))
  }

  async function addOwner(user: UserOption) {
    const result = await run(
      {
        type: "addOwner",
        member: toOwner(user, project.primaryOwnerId),
      },
      () => executeAddOwner({ projectId, userId: user.id })
    )
    if (result?.serverError) reportError(result)
    else if (result?.data) toast.success(t("ownerAdded"))
    return result
  }

  async function removeOwner(userId: string) {
    const result = await run({ type: "removeMember", userId }, () =>
      executeRemoveOwner({ projectId, userId })
    )
    if (result?.serverError) reportError(result)
    else if (result?.data) toast.success(t("ownerRemoved"))
    return result
  }

  async function addCollaborator(user: UserOption) {
    const result = await run(
      { type: "addCollaborator", member: toMember(user) },
      () => executeAddCollaborator({ projectId, userId: user.id })
    )
    if (result?.serverError) reportError(result)
    else if (result?.data) toast.success(t("collaboratorAdded"))
    return result
  }

  async function removeCollaborator(userId: string) {
    const result = await run({ type: "removeMember", userId }, () =>
      executeRemoveCollaborator({ projectId, userId })
    )
    if (result?.serverError) reportError(result)
    else if (result?.data) toast.success(t("collaboratorRemoved"))
    return result
  }

  return { addOwner, removeOwner, addCollaborator, removeCollaborator }
}
