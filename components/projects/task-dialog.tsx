"use client"

import { Dialog } from "@/components/common/dialog"
import type { TaskWithAssignmentsDTO } from "@/actions/schemas/task"
import { useTranslations } from "next-intl"
import { TaskForm } from "./task-form"

export interface TaskFormValues {
  name: string
  description: string
  cost: string
  priority: string | null
  assigneeIds: string[]
  startDate: string | null
  endDate: string | null
}

interface TaskDialogProps {
  task?: TaskWithAssignmentsDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: TaskFormValues) => void
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
