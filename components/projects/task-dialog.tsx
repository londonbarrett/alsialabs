"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ProjectTask } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { TaskForm } from "./task-form"

interface TaskDialogProps {
  task?: ProjectTask
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: TaskDialogProps) {
  const t = useTranslations("projects.tasks")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {task ? t("editTask") : t("addTask")}
          </DialogTitle>
          <DialogDescription>
            {task ? t("updateDetails") : t("fillDetails")}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          projectId={projectId}
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
