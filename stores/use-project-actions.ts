"use client"

import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import type { ProjectDetail } from "@/lib/actions/projects"
import {
  deleteProject as deleteProjectAction,
  updateProject as updateProjectAction,
} from "@/lib/actions/projects"
import type { UpdateProjectInput } from "@/lib/schemas/project"
import { useActionError } from "@/lib/util/action-errors"
import { useProjectContextStore } from "@/stores/project-context-store"
import { useProjectContext } from "@/stores/use-project-context"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type ProjectUpdateValues = Omit<UpdateProjectInput, "projectId">

/**
 * The action normalises empty strings to null (see `updateProject`), so the
 * optimistic patch has to coerce identically or the header would briefly show
 * "" where the committed value is null.
 */
function toOptimisticPatch(
  values: ProjectUpdateValues
): Partial<ProjectDetail> {
  return {
    name: values.name,
    categoryId: values.categoryId,
    status: values.status,
    description: values.description || null,
    startDate: values.startDate,
    endDate: values.endDate || null,
    location: values.location || null,
    budget: values.budget ? values.budget : null,
    color: values.color,
  }
}

// TODO: Context should be read only, refactor when stores are done
/**
 * Mutations on the open project. Takes no projectId — it reads the id from the
 * project context, so it can never disagree with the row on screen. Must be
 * used under a `ProjectContextProvider`; the projects list page has no context
 * and calls `createProject` directly instead.
 */
export function useProjectActions() {
  const t = useTranslations()
  const translateError = useActionError()
  const router = useRouter()
  const { projectId } = useProjectContext()
  const { run, isPending } = useOptimisticAction(
    useProjectContextStore()
  )
  const { executeAsync: executeUpdate } = useAction(updateProjectAction)
  const { executeAsync: executeDelete } = useAction(deleteProjectAction)

  async function updateProject(values: ProjectUpdateValues) {
    const result = await run(
      { type: "patchProject", patch: toOptimisticPatch(values) },
      () => executeUpdate({ projectId, ...values }),
      {
        // Layer the authoritative row on top so server-side normalisation wins.
        commitAction: (r) => ({
          type: "patchProject",
          patch: (r.data ?? {}) as Partial<ProjectDetail>,
        }),
      }
    )
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result?.data) {
      toast.success(t("projects.projectUpdated"))
    }
    return result
  }

  // No optimistic action: the provider owning this store unmounts as soon as
  // we navigate away, so there is nothing left to update.
  async function deleteProject() {
    const result = await executeDelete({ projectId })
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      return result
    }
    toast.success(t("projects.projectDeleted"))
    router.push("/app/proyectos")
    return result
  }

  return { isPending, updateProject, deleteProject }
}
