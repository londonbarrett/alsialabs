"use client"

import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmAction {
  label: string
  onClick: () => void
  variant?: "default" | "outline" | "destructive"
}

interface ActionConfirmDialogProps {
  open: boolean
  title: string
  message: string
  actions: ConfirmAction[]
  onCancel: () => void
  loading?: boolean
}

export function ActionConfirmDialog({
  open,
  title,
  message,
  actions,
  onCancel,
  loading,
}: ActionConfirmDialogProps) {
  const t = useTranslations()
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {actions.map((action, index) => (
            <Button
              key={`${action.label}-${index}`}
              variant={action.variant ?? "outline"}
              onClick={action.onClick}
              disabled={loading}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
