"use client"

import { Dialog } from "@/components/common/dialog"
import type { Routine } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./routine-details-step"
import { RoutineForm } from "./routine-form"

interface RoutineDialogProps {
  routine?: Routine
  projectMembers: ProjectMember[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    recurrence: string
    interval: string
    daysOfWeek: string[]
    time: string
    startDate: string
    endDate: string
    assigneeId: string | null
  }) => Promise<{
    success: boolean
    fieldErrors?: Record<string, string[]>
    error?: string
  }>
}

export function RoutineDialog({
  routine,
  projectMembers,
  open,
  onOpenChange,
  onSubmit,
}: RoutineDialogProps) {
  const t = useTranslations("projects.routines")
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={routine ? t("editRoutine") : t("addRoutine")}
      description={routine ? t("updateDetails") : t("fillDetails")}
      onInteractOutside={(e) => e.preventDefault()}
    >
      <RoutineForm
        routine={routine}
        projectMembers={projectMembers}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
