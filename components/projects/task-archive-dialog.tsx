"use client"

import { ActionConfirmDialog } from "@/components/common/action-confirm-dialog"
import { useTranslations } from "next-intl"

interface TaskArchiveDialogProps {
  open: boolean
  onArchive: (closeAs: "done" | "cancelled") => void
  onCancel: () => void
}

export function TaskArchiveDialog({
  open,
  onArchive,
  onCancel,
}: TaskArchiveDialogProps) {
  const t = useTranslations("projects.tasks.archive")

  return (
    <ActionConfirmDialog
      open={open}
      title={t("title")}
      message={t("message")}
      actions={[
        {
          label: t("markDone"),
          onClick: () => onArchive("done"),
          variant: "default",
        },
        {
          label: t("markCancelled"),
          onClick: () => onArchive("cancelled"),
          variant: "outline",
        },
      ]}
      onCancel={onCancel}
    />
  )
}
