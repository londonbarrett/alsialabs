"use client"

import type { ProjectFormValues } from "@/components/projects/project-form"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { createProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/types"
import { useActionError } from "@/lib/util/action-errors"
import {
  nextOptimisticProjectId,
  useProjectsStore,
  type ProjectsAction,
} from "@/stores/projects-store"
import type { Session } from "next-auth"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type ProjectOwnerSeed = {
  id: string
  name: string
  image: string | null
}

function toOwnerSeed(
  user: Session["user"] | undefined
): ProjectOwnerSeed | null {
  if (!user) return null
  return {
    id: user.id,
    name: user.name ?? user.email ?? "",
    image: user.image ?? null,
  }
}

function buildOptimisticProject(
  values: ProjectFormValues,
  currentOwner: ProjectOwnerSeed,
  categorySlug: string | null
): Project {
  return {
    id: nextOptimisticProjectId(),
    primaryOwnerId: currentOwner.id,
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
    owners: [currentOwner],
    collaborators: [],
  }
}

export function useProjectsActions(
  categories: { id: string; slug: string }[]
) {
  const t = useTranslations()
  const translateError = useActionError()
  const router = useRouter()
  const { data: session } = useSession()
  const { run } = useOptimisticAction(useProjectsStore())

  async function createProjectAction(
    values: ProjectFormValues
  ): Promise<void> {
    const owner = toOwnerSeed(session?.user)
    const execute = () => createProject(values)
    const optimisticProject = owner
      ? buildOptimisticProject(
          values,
          owner,
          categories.find((c) => c.id === values.categoryId)?.slug ??
            null
        )
      : null

    const result = optimisticProject
      ? await run(
          { type: "add", project: optimisticProject },
          execute,
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
      : await execute().then((r) => {
          if (r?.data) router.refresh()
          return r
        })

    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result?.data) {
      toast.success(t("projects.projectCreated"))
    }
  }

  return { createProject: createProjectAction }
}
