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
  type ProjectDetail,
} from "@/lib/actions/projects"
import type { Project as DbProject } from "@/lib/drizzle/schema"
import {
  PROJECT_COLORS,
  PROJECT_COLOR_NAME_KEYS,
  type ProjectColor,
} from "@/components/projects/colors"
import type { ProjectMember } from "@/lib/types"
import {
  Calendar,
  ClipboardList,
  Crown,
  FileText,
  MapPin,
  Pencil,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { useActionError } from "@/lib/util/action-errors"
import { ProjectDialog } from "./project-dialog"

interface ProjectDetailsProps {
  project: ProjectDetail
  categories: { id: string; slug: string; name: string }[]
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
  const translateError = useActionError()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<
    DbProject | undefined
  >()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const colorIndex = PROJECT_COLORS.indexOf(
    project.color as ProjectColor
  )
  const colorNameKey =
    colorIndex >= 0 ? PROJECT_COLOR_NAME_KEYS[colorIndex] : undefined

  async function handleEdit() {
    setLoadingEdit(true)
    startLoading()
    const result = await getProjectForEdit({ projectId: project.id })
    stopLoading()
    setLoadingEdit(false)
    const full = result.data
    if (!full) {
      toast.error(t("common.somethingWentWrong"))
      return
    }
    setEditingProject(full)
    setProjectDialogOpen(true)
  }

  async function handleDelete() {
    setDeleteDialogOpen(false)
    setDeleting(true)
    startLoading()
    const result = await deleteProject({ projectId: project.id })
    stopLoading()
    if (result.serverError) {
      toast.error(translateError(result.serverError.code))
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
                {project.categorySlug &&
                t.has(`categoryNames.${project.categorySlug}`)
                  ? t(`categoryNames.${project.categorySlug}`)
                  : project.categoryName || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 size-4 shrink-0 rounded-full border border-border/50"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.color")}
              </p>
              <p className="text-sm font-medium">
                {colorNameKey
                  ? t(`projects.colors.${colorNameKey}`)
                  : project.color}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEdit}
              disabled={loadingEdit}
            >
              {loadingEdit ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
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
