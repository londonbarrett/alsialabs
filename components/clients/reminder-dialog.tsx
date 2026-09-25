"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Dialog } from "@/components/common/dialog"
import {
  useTimelineStore,
  type ReminderDialogTarget,
} from "@/stores/timeline-store"
import { useRemindersStore } from "@/stores/reminders-store"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { upsertReminder } from "@/lib/actions/reminders"
import { buildTempReminder } from "@/lib/util/temp-entries"
import { toast } from "sonner"

export interface ReminderSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface ReminderDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: ReminderDialogTarget
}

export function ReminderDialog({
  clientId,
  open,
  onOpenChange,
  reminder,
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
      />
    </Dialog>
  )
}

function ReminderForm({
  clientId,
  reminder,
  onOpenChange,
}: {
  clientId: string
  reminder?: ReminderDialogTarget
  onOpenChange: (open: boolean) => void
}) {
  const { run } = useOptimisticAction(useTimelineStore)
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

    const action = isEdit
      ? {
          type: "patch" as const,
          kind: "reminder" as const,
          id: reminder!.id,
          patch: {
            description: data.description,
            remindAt: data.remindAt,
          },
        }
      : { type: "add" as const, entry: buildTempReminder(data) }

    // Also optimistically update the reminders store when editing
    let reminderId: number | null = null
    if (isEdit) {
      reminderId = useRemindersStore.getState().pend({
        type: "patch",
        id: reminder!.id,
        patch: {
          description: data.description,
          remindAt: data.remindAt,
        },
      })
    }

    const result = await run(
      action,
      () => upsertReminder(data, reminder?.id),
      {
        key: clientId,
        onSuccess: () => {
          if (reminderId != null) {
            useRemindersStore.getState().commit(reminderId)
          }
        },
        onFailure: () => {
          if (reminderId != null) {
            useRemindersStore.getState().discard(reminderId)
          }
        },
      }
    )

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
