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

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface TaskDialogProps {
  task?: ProjectTask
  projectMembers: ProjectMember[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    status: string
    assigneeId: string | null
  }) => Promise<{
    success: boolean
    fieldErrors?: Record<string, string[]>
    error?: string
  }>
}

export function TaskDialog({
  task,
  projectMembers,
  open,
  onOpenChange,
  onSubmit,
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
          projectMembers={projectMembers}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
