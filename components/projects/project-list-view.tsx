"use client"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { createProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/types"
import { useActionError } from "@/lib/util/action-errors"
import { useHasPermission } from "@/stores/permissions-store"
import { FolderKanban, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ProjectCard } from "./project-card"
import { ProjectDialog } from "./project-dialog"
import type {
  ProjectFormResult,
  ProjectFormValues,
} from "./project-form"

interface ProjectListViewProps {
  projects: Project[]
  categories: { id: string; slug: string; name: string }[]
}

export function ProjectListView({
  projects,
  categories,
}: ProjectListViewProps) {
  const t = useTranslations()
  const router = useRouter()
  const canCreate = useHasPermission("projects:create")
  const [dialogOpen, setDialogOpen] = useState(false)

  const translateError = useActionError()
  const { executeAsync: executeCreate } = useAction(createProject)

  function handleSuccess() {
    router.refresh()
  }

  /** This page creates; editing lives in the project detail subpage. */
  async function handleCreate(
    values: ProjectFormValues
  ): Promise<ProjectFormResult> {
    const result = await executeCreate(values)
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result?.data) {
      toast.success(t("projects.projectCreated"))
    }
    return result
  }

  function openNew() {
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
  }

  return (
    <>
      {projects.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">
            {t("projects.noProjects")}
          </p>
          {canCreate && (
            <Button
              onClick={openNew}
              aria-label={t("projects.addProject")}
            >
              <Plus />
              {t("projects.addProject")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6 p-6">
          <PageHeader
            title={t("projects.title")}
            subtitle={t("projects.subtitle")}
            icon={FolderKanban}
          >
            {canCreate && (
              <Button
                onClick={openNew}
                aria-label={t("projects.addProject")}
              >
                <Plus />
                {t("projects.addProject")}
              </Button>
            )}
          </PageHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}
      <ProjectDialog
        categories={categories}
        onSubmit={handleCreate}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
