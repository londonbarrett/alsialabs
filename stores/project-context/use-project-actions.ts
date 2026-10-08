"use client"

import type { ProjectDetail } from "@/actions/projects"
import {
  deleteProject as deleteProjectAction,
  updateProject as updateProjectAction,
} from "@/actions/projects"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { useSettle } from "@/hooks/use-settle"
import type { UpdateProjectInput } from "@/lib/schemas/project"
import { useProjectContextStore } from "./project-context-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useProjectContextState } from "./use-project-context-state"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"

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

/**
 * Mutations on the open project. Takes no projectId — it reads the id from the
 * project context, so it can never disagree with the row on screen. Must be
 * used under a `ProjectContextProvider`. For creating, see
 * `useProjectsActions`, which writes to the projects list store instead.
 */
export function useProjectActions() {
  const t = useTranslations()
  const settle = useSettle()
  const router = useRouter()
  const { run } = useOptimisticAction(useProjectContextStore())
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const { executeAsync: executeUpdate } = useAction(updateProjectAction)
  const { executeAsync: executeDelete } = useAction(deleteProjectAction)
  const { projectId } = useProjectContextState()

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
    settle(result, t("projects.projectUpdated"))
  }

  // No optimistic action: the provider owning this store unmounts as soon as
  // we navigate away, so there is nothing left to update. The loading bar is
  // still driven here, since the mutation is not running through `run`.
  async function deleteProject() {
    startLoading()
    try {
      const result = await executeDelete({ projectId })
      const settled = settle(result, t("projects.projectDeleted"))
      if (settled.success) router.push("/app/proyectos")
    } finally {
      stopLoading()
    }
  }

  return { updateProject, deleteProject }
}
