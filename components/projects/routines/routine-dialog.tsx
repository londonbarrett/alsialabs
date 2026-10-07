"use client"

import { Dialog } from "@/components/common/dialog"
import type { Routine } from "@/lib/drizzle/schema"
import type { RoutineSubmitData } from "@/lib/types"
import { useTranslations } from "next-intl"
import { RoutineForm } from "./routine-form"

interface RoutineDialogProps {
  routine?: Routine
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RoutineSubmitData) => void
}

export function RoutineDialog({
  routine,
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
    >
      <RoutineForm
        routine={routine}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
