"use client"

import { Money } from "@/components/common/money"
import { Card, CardContent } from "@/components/ui/card"
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
}

export function ProjectDetails({
  project,
  primaryOwner,
}: ProjectDetailsProps) {
  const t = useTranslations()
  const tc = useTranslations("category-names")

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-3 gap-6">
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
          {project.description && (
            <div className="col-span-3">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("projects.description")}
              </p>
              <p className="text-sm">{project.description}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
