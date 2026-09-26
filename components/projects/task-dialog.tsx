"use client"

import { Dialog } from "@/components/common/dialog"
import type { Task } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { TaskForm } from "./task-form"

interface TaskDialogProps {
  task?: Task
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
    >
      <TaskForm
        task={task}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
