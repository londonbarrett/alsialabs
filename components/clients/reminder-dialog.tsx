'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Dialog } from '@/components/common/dialog'
import type { ClientReminder } from '@/lib/drizzle/schema'

export interface ReminderSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface ReminderDialogProps {
  clientId: string
  reminder?: ClientReminder
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    data: { clientId: string; description: string; remindAt: string },
    reminderId?: string
  ) => Promise<ReminderSubmitResult>
}

export function ReminderDialog({
  clientId,
  reminder,
  open,
  onOpenChange,
  onSubmit,
}: ReminderDialogProps) {
  const t = useTranslations()
  const [description, setDescription] = useState(reminder?.description ?? '')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [remindAt, setRemindAt] = useState(
    reminder?.remindAt ?? tomorrow.toISOString().split('T')[0]
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim())
      fieldErrors.description = t('reminders.descriptionRequired')
    if (!remindAt) fieldErrors.remindAt = t('reminders.dateRequired')
    else {
      const d = new Date(remindAt + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d < today) fieldErrors.remindAt = t('reminders.dateMustBeFuture')
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    onSubmit(
      { clientId, description: description.trim(), remindAt },
      reminder?.id
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        reminder ? t('reminders.editReminder') : t('reminders.addReminder')
      }
      description={
        reminder ? t('reminders.updateDetails') : t('reminders.setFollowUp')
      }
      onInteractOutside={(e) => e.preventDefault()}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={!!errors.description || undefined}>
            <FieldLabel htmlFor="description">
              {t('reminders.description')}
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
              {t('reminders.dueDate')}
            </FieldLabel>
            <Input
              id="remindAt"
              type="date"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              aria-invalid={!!errors.remindAt || undefined}
            />
            {errors.remindAt && <FieldError>{errors.remindAt}</FieldError>}
          </Field>
          <Field orientation="horizontal" className="justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('reminders.cancel')}
            </Button>
            <Button type="submit">
              {reminder
                ? t('reminders.saveChanges')
                : t('reminders.addReminderBtn')}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </Dialog>
  )
}
