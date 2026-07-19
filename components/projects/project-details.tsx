"use client"

import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Money } from "@/components/common/money"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  deleteProject,
  getProjectForEdit,
} from "@/lib/actions/projects"
import type { Project as DbProject } from "@/lib/drizzle/schema"
import { Calendar, ClipboardList, Crown, FileText, MapPin, Pencil, Tag, Trash2, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ProjectMember } from "./project-detail-view"
import { ProjectDialog } from "./project-dialog"

interface ProjectDetailsProps {
  project: {
    id: string
    name: string
    categoryId: string
    categorySlug: string | null
    startDate: string
    endDate: string | null
    location: string | null
    budget: string | null
    description: string | null
    status: string
  }
  categories: { id: string; slug: string }[]
  primaryOwner: ProjectMember | undefined
  canEdit: boolean
  canDelete: boolean
}

export function ProjectDetails({
  project,
  categories,
  primaryOwner,
  canEdit,
  canDelete,
}: ProjectDetailsProps) {
  const router = useRouter()
  const t = useTranslations()
  const tc = useTranslations("category-names")
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<DbProject | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleEdit() {
    const full = await getProjectForEdit(project.id)
    setEditingProject(full)
    setProjectDialogOpen(true)
  }

  async function handleDelete() {
    setDeleteDialogOpen(false)
    setDeleting(true)
    const result = await deleteProject(project.id)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
      setDeleting(false)
    } else {
      toast.success(t("projects.projectDeleted"))
      router.push("/dashboard/projects")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          {t("projects.detail.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.primaryOwner")}
              </p>
              <p className="text-sm font-medium">
                {primaryOwner?.userName ||
                  primaryOwner?.userEmail ||
                  "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.category")}
              </p>
              <p className="text-sm font-medium">
                {project.categorySlug ? tc(project.categorySlug) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.location")}
              </p>
              <p className="text-sm font-medium">
                {project.location || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.budget")}
              </p>
              <p className="text-sm font-medium">
                <Money value={project.budget} />
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.startDate")}
              </p>
              <p className="text-sm font-medium">{project.startDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.endDate")}
              </p>
              <p className="text-sm font-medium">
                {project.endDate || "—"}
              </p>
            </div>
          </div>
          {project.description && (
            <div className="col-span-3 flex items-start gap-3">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  {t("projects.description")}
                </p>
                <p className="text-sm">{project.description}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {(canEdit || canDelete) && (
        <CardFooter className="flex justify-end gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
              {t("projects.card.edit")}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("projects.card.deleteProject")}
            </Button>
          )}
        </CardFooter>
      )}

      <ProjectDialog
        project={editingProject}
        categories={categories}
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open)
          if (!open) setEditingProject(undefined)
        }}
        onSuccess={() => {
          router.refresh()
          setEditingProject(undefined)
        }}
      />

      <DestructiveDialog
        open={deleteDialogOpen}
        title={t("actionMenu.deleteTitle")}
        message={t("actionMenu.confirmDelete", { name: project.name })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleting}
      />
    </Card>
  )
}
