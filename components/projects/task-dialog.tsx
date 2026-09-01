"use client"

import { Dialog } from "@/components/common/dialog"
import type { Task } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { TaskForm } from "./task-form"

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface TaskDialogProps {
  task?: Task
  projectMembers: ProjectMember[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    status: string
    priority: string | null
    dueDate: string | null
    assigneeId: string | null
  }) => void
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? t("editTask") : t("addTask")}
      description={task ? t("updateDetails") : t("fillDetails")}
      onInteractOutside={(e) => e.preventDefault()}
    >
      <TaskForm
        task={task}
        projectMembers={projectMembers}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
