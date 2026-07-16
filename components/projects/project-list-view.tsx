"use client"

import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/types"
import { Plus } from "lucide-react"
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
          <div className="flex justify-between">
            <header className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t("projects.portfolio")}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
                {t("projects.title")}
              </h1>
              <p className="max-w-prose text-pretty text-muted-foreground">
                {t("projects.subtitle")}
              </p>
            </header>
            {permissions.includes("projects:create") && (
              <Button
                onClick={openNew}
                aria-label={t("projects.addProject")}
                className="self-start"
              >
                <Plus />
                {t("projects.addProject")}
              </Button>
            )}
          </div>

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
