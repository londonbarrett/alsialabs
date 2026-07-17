"use client"

import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Money } from "@/components/common/money"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  addProjectCollaborator,
  addProjectOwner,
  removeProjectCollaborator,
  removeProjectOwner,
} from "@/lib/actions/project-users"
import {
  deleteProject,
  getProjectForEdit,
  upsertProject,
} from "@/lib/actions/projects"
import type {
  Project as DbProject,
  ProjectTask,
} from "@/lib/drizzle/schema"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ProjectCollaborators } from "./project-collaborators"
import { ProjectDialog } from "./project-dialog"
import { ProjectOwners } from "./project-owners"
import { ProjectTasks } from "./project-tasks"

export interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface ProjectDetailViewProps {
  project: {
    id: string
    primaryOwnerId: string
    name: string
    categoryId: string
    description: string | null
    status: string
    startDate: string
    endDate: string | null
    location: string | null
    budget: string | null
    categorySlug: string | null
  }
  tasks: ProjectTask[]
  categories: { id: string; slug: string }[]
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  allUsers: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }[]
  currentUserId: string
  isCurrentUserAdmin: boolean
  permissions?: string[]
}

const statusColors: Record<string, string> = {
  active:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
}

export function ProjectDetailView({
  project,
  tasks,
  categories,
  owners,
  collaborators,
  allUsers,
  currentUserId,
  isCurrentUserAdmin,
  permissions = [],
}: ProjectDetailViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const tc = useTranslations("category-names")
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<
    DbProject | undefined
  >()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isPrimaryOwner = project.primaryOwnerId === currentUserId
  const isOwner =
    owners.some((o) => o.userId === currentUserId) || isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const canManageUsers = isPrimaryOwner || isCurrentUserAdmin
  const canDelete = isPrimaryOwner || isCurrentUserAdmin

  async function handleProjectStatusChange(status: string) {
    const result = await upsertProject(
      {
        name: project.name,
        categoryId: project.categoryId,
        description: project.description ?? "",
        startDate: project.startDate,
        endDate: project.endDate ?? "",
        location: project.location ?? "",
        budget: project.budget ?? "",
        status: status as
          | "active"
          | "completed"
          | "cancelled"
          | "archived",
      },
      project.id
    )
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
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

  async function handleEdit() {
    const full = await getProjectForEdit(project.id)
    setEditingProject(full)
    setProjectDialogOpen(true)
  }

  async function handleAddOwner(userId: string) {
    const result = await addProjectOwner(project.id, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleRemoveOwner(userId: string) {
    const result = await removeProjectOwner(project.id, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleAddCollaborator(userId: string) {
    const result = await addProjectCollaborator(project.id, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleRemoveCollaborator(userId: string) {
    const result = await removeProjectCollaborator(project.id, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  const ownerUserIds = new Set(owners.map((o) => o.userId))
  const collaboratorUserIds = new Set(
    collaborators.map((c) => c.userId)
  )
  const availableUsers = allUsers.filter(
    (u) => !ownerUserIds.has(u.id) && !collaboratorUserIds.has(u.id)
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.detail.title")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-4 w-4" />
                {t("projects.card.edit")}
              </Button>
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
            </>
          )}
          {canEdit ? (
            <Select
              value={project.status}
              onValueChange={handleProjectStatusChange}
            >
              <SelectTrigger className="h-7 w-37">
                <SelectValue>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[project.status]}`}
                  >
                    {t(`projects.status.${project.status}`)}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "active",
                    "completed",
                    "cancelled",
                    "archived",
                  ] as const
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s]}`}
                    >
                      {t(`projects.status.${s}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {t(`projects.status.${project.status}`)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 rounded-lg border p-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("projects.category")}
          </p>
          <p className="text-sm font-medium">
            {project.categorySlug ? tc(project.categorySlug) : "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("projects.startDate")}
          </p>
          <p className="text-sm font-medium">{project.startDate}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("projects.endDate")}
          </p>
          <p className="text-sm font-medium">
            {project.endDate || "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("projects.location")}
          </p>
          <p className="text-sm font-medium">
            {project.location || "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("projects.budget")}
          </p>
          <p className="text-sm font-medium">
            <Money value={project.budget} />
          </p>
        </div>
        {project.description && (
          <div className="col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {t("projects.description")}
            </p>
            <p className="text-sm">{project.description}</p>
          </div>
        )}
      </div>

      <ProjectOwners
        owners={owners}
        primaryOwnerId={project.primaryOwnerId}
        availableUsers={availableUsers}
        canManageUsers={canManageUsers}
        onAddOwner={handleAddOwner}
        onRemoveOwner={handleRemoveOwner}
      />

      <ProjectCollaborators
        collaborators={collaborators}
        availableUsers={availableUsers}
        isOwner={isOwner}
        onAddCollaborator={handleAddCollaborator}
        onRemoveCollaborator={handleRemoveCollaborator}
      />

      <ProjectTasks
        tasks={tasks}
        projectId={project.id}
        canEdit={canEdit}
        isOwner={isOwner}
        isCollaborator={
          !isOwner &&
          collaborators.some((c) => c.userId === currentUserId)
        }
        currentUserId={currentUserId}
        permissions={permissions}
        projectMembers={[...owners, ...collaborators]}
      />

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
    </div>
  )
}
