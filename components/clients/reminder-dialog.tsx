"use client"

import { Dialog } from "@/components/common/dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type {
  ReminderSubmitData,
  ReminderSubmitResult,
} from "@/hooks/use-reminder-submit"
import type { Reminder } from "@/lib/actions/reminders"
import type { ClientReminder } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

/** The dialog is used from the client page (timeline rows) and the activity
 *  page (reminder rows), so it accepts either reminder shape. */
type ReminderDialogTarget = ClientReminder | Reminder

interface ReminderDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: ReminderDialogTarget
  onSubmit: (
    data: ReminderSubmitData,
    editingId?: string
  ) => Promise<ReminderSubmitResult>
}

export function ReminderDialog({
  clientId,
  open,
  onOpenChange,
  reminder,
  onSubmit,
}: ReminderDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        reminder
          ? t("reminders.editReminder")
          : t("reminders.addReminder")
      }
      description={
        reminder
          ? t("reminders.updateDetails")
          : t("reminders.setFollowUp")
      }
    >
      <ReminderForm
        key={open ? (reminder?.id ?? "new") : "closed"}
        clientId={clientId}
        reminder={reminder}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    </Dialog>
  )
}

function ReminderForm({
  clientId,
  reminder,
  onOpenChange,
  onSubmit,
}: {
  clientId: string
  reminder?: ReminderDialogTarget
  onOpenChange: (open: boolean) => void
  onSubmit: (
    data: ReminderSubmitData,
    editingId?: string
  ) => Promise<ReminderSubmitResult>
}) {
  const t = useTranslations()

  const [description, setDescription] = useState(
    reminder?.description ?? ""
  )
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [remindAt, setRemindAt] = useState(
    reminder?.remindAt ?? tomorrow.toISOString().split("T")[0]
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim())
      fieldErrors.description = t("reminders.descriptionRequired")
    if (!remindAt) fieldErrors.remindAt = t("reminders.dateRequired")
    else {
      const d = new Date(remindAt + "T00:00:00")
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d < today)
        fieldErrors.remindAt = t("reminders.dateMustBeFuture")
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    if (!validate()) return

    const isEdit = !!reminder?.id
    const data = { clientId, description: description.trim(), remindAt }

    onOpenChange(false)

    const result = await onSubmit(data, reminder?.id)

    if (result.success) {
      toast.success(
        isEdit
          ? t("reminders.reminderUpdated")
          : t("reminders.reminderCreated")
      )
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={!!errors.description || undefined}>
          <FieldLabel htmlFor="description">
            {t("reminders.description")}
          </FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description || undefined}
          />
          {errors.description && (
            <FieldError>{errors.description}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!errors.remindAt || undefined}>
          <FieldLabel htmlFor="remindAt">
            {t("reminders.dueDate")}
          </FieldLabel>
          <Input
            id="remindAt"
            type="date"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            aria-invalid={!!errors.remindAt || undefined}
          />
          {errors.remindAt && (
            <FieldError>{errors.remindAt}</FieldError>
          )}
        </Field>
        <Field orientation="horizontal" className="justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("reminders.cancel")}
          </Button>
          <Button type="submit">
            {reminder
              ? t("reminders.saveChanges")
              : t("reminders.addReminderBtn")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
