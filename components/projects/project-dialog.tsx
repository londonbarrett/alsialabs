"use client"

import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ProjectForm } from "./project-form"
import type { Project } from "@/lib/drizzle/schema"

interface ProjectDialogProps {
  project?: Project
  categories: { id: string; slug: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProjectDialog({
  project,
  categories,
  open,
  onOpenChange,
  onSuccess,
}: ProjectDialogProps) {
  const t = useTranslations("projects")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
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
          onSuccess={() => {
            onSuccess()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
