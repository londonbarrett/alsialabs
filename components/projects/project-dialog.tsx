"use client"

import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ProjectForm, type ProjectFormSubmit } from "./project-form"
import type { Project } from "@/lib/drizzle/schema"

export type ProjectDialogProps = {
  categories: { id: string; slug: string; name: string }[]
  /** Pre-fills the form for an edit; omit to create. */
  project?: Project
  onSubmit: ProjectFormSubmit
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reported after a successful submit, e.g. to refresh a list. */
  onSuccess?: () => void
}

export function ProjectDialog({
  categories,
  project,
  onSubmit,
  open,
  onOpenChange,
  onSuccess,
}: ProjectDialogProps) {
  const t = useTranslations("projects")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? t("editProject") : t("addProject")}
          </DialogTitle>
          <DialogDescription>
            {project ? t("updateDetails") : t("fillDetails")}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          project={project}
          categories={categories}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (values) => {
            const result = await onSubmit(values)
            if (result?.data) {
              onSuccess?.()
              onOpenChange(false)
            }
            return result
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
