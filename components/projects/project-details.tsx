"use client"

import { Money } from "@/components/common/money"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Calendar, Crown, FileText, MapPin, Pencil, Tag, Trash2, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./project-detail-view"

interface ProjectDetailsProps {
  project: {
    categorySlug: string | null
    startDate: string
    endDate: string | null
    location: string | null
    budget: string | null
    description: string | null
  }
  primaryOwner: ProjectMember | undefined
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function ProjectDetails({
  project,
  primaryOwner,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ProjectDetailsProps) {
  const t = useTranslations()
  const tc = useTranslations("category-names")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("projects.detail.title")}</CardTitle>
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
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              {t("projects.card.edit")}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {t("projects.card.deleteProject")}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
