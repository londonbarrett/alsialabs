"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import { useCallback, useId, useState } from "react"

type Props = {
  filename: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RestoreDialog({
  filename,
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations()
  const inputId = useId()
  const [typed, setTyped] = useState("")
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setTyped("")
  }

  const handleConfirm = useCallback(() => {
    onConfirm()
    onOpenChange(false)
  }, [onConfirm, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("backups.restoreTitle")}</DialogTitle>
          <DialogDescription>
            {t("backups.restorePrompt")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={inputId}>{filename}</FieldLabel>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={typed !== filename}>
            {t("backups.restore")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
