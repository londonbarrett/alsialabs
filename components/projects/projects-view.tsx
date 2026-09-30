"use client"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { useProjectsList } from "@/hooks/use-projects-list"
import { useHasPermission } from "@/stores/permissions-store"
import { useProjectsActions } from "@/stores/use-projects-actions"
import { FolderKanban, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ProjectCard } from "./project-card"
import { ProjectDialog } from "./project-dialog"

interface ProjectsViewProps {
  categories: { id: string; slug: string; name: string }[]
}

export function ProjectsView({ categories }: ProjectsViewProps) {
  const t = useTranslations()
  const canCreate = useHasPermission("projects:create")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { projects, pendingIds } = useProjectsList()
  const { createProject } = useProjectsActions(categories)

  return (
    <>
      {projects.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">
            {t("projects.noProjects")}
          </p>
          {canCreate && (
            <Button
              onClick={() => setDialogOpen(true)}
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
                onClick={() => setDialogOpen(true)}
                aria-label={t("projects.addProject")}
              >
                <Plus />
                {t("projects.addProject")}
              </Button>
            )}
          </PageHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isPending={pendingIds.has(project.id)}
              />
            ))}
          </div>
        </div>
      )}
      <ProjectDialog
        categories={categories}
        onSubmit={createProject}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
