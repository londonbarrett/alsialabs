"use client"

import type { ProjectFormValues } from "@/components/projects/project-form"
import { useSettle } from "@/hooks/use-settle"
import { createProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/types"
import {
  nextOptimisticProjectId,
  type ProjectsAction,
} from "@/stores/projects-reducer"
import { useProjectsStore } from "@/stores/projects-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"

/** The signed-in user as a `Project` owner row, seeded server-side so the
 *  optimistic row renders with its real owner instead of waiting on
 *  `useSession` to hydrate. */
export type ProjectOwner = Project["owners"][number]

function buildOptimisticProject(
  values: ProjectFormValues,
  owner: ProjectOwner,
  categorySlug: string | null
): Project {
  return {
    id: nextOptimisticProjectId(),
    primaryOwnerId: owner.id,
    name: values.name,
    description: values.description || null,
    status: values.status,
    color: values.color,
    categorySlug,
    startDate: values.startDate,
    endDate: values.endDate || "",
    location: values.location || null,
    budget: values.budget ? Number(values.budget) : 0,
    expenses: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    inProgressTasks: [],
    owners: [owner],
    collaborators: [],
  }
}

export function useProjectsActions(
  categories: { id: string; slug: string }[],
  owner: ProjectOwner
) {
  const t = useTranslations()
  const settle = useSettle()
  const { run } = useOptimisticAction(useProjectsStore())

  async function createProjectAction(
    values: ProjectFormValues
  ): Promise<void> {
    const optimisticProject = buildOptimisticProject(
      values,
      owner,
      categories.find((c) => c.id === values.categoryId)?.slug ?? null
    )

    const result = await run(
      { type: "add", project: optimisticProject },
      () => createProject(values),
      {
        commitAction: (r): ProjectsAction => ({
          type: "replaceTemp",
          tempId: optimisticProject.id,
          project: {
            ...optimisticProject,
            ...(r.data
              ? {
                  id: r.data.id,
                  primaryOwnerId: r.data.primaryOwnerId,
                  name: r.data.name,
                  description: r.data.description,
                  status: r.data.status,
                  color: r.data.color,
                  startDate: r.data.startDate,
                  endDate: r.data.endDate ?? "",
                  location: r.data.location,
                  budget: r.data.budget ? Number(r.data.budget) : 0,
                }
              : {}),
          },
        }),
      }
    )

    settle(result, t("projects.projectCreated"))
  }

  return { createProject: createProjectAction }
}
