"use client"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/types"
import { FolderKanban, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ProjectCard } from "./project-card"
import { ProjectDialog } from "./project-dialog"

interface ProjectListViewProps {
  projects: Project[]
  categories: { id: string; slug: string }[]
  permissions?: string[]
}

export function ProjectListView({
  projects,
  categories,
  permissions = [],
}: ProjectListViewProps) {
  const t = useTranslations()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSuccess() {
    router.refresh()
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
          {permissions.includes("projects:create") && (
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
            {permissions.includes("projects:create") && (
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
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
