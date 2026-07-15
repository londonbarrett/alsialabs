'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { upsertReminder } from '@/lib/actions/reminders'
import type { ClientReminder } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ReminderDialogProps {
  clientId: string
  reminder?: ClientReminder
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ReminderDialog({ clientId, reminder, open, onOpenChange, onSuccess }: ReminderDialogProps) {
  const t = useTranslations()
  const [description, setDescription] = useState(reminder?.description ?? '')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [remindAt, setRemindAt] = useState(reminder?.remindAt ?? tomorrow.toISOString().split('T')[0])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim()) fieldErrors.description = t('reminders.descriptionRequired')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const result = await upsertReminder(
        { clientId, description: description.trim(), remindAt },
        reminder?.id,
      )
      if (result.success) {
        toast.success(reminder ? t('reminders.reminderUpdated') : t('reminders.reminderCreated'))
        onSuccess()
        onOpenChange(false)
      } else {
        if (result.fieldErrors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(result.fieldErrors)) {
            if (msgs && msgs.length > 0) mapped[key] = msgs[0]
          }
          setErrors(mapped)
        }
        toast.error(result.error || t('common.somethingWentWrong'))
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{reminder ? t('reminders.editReminder') : t('reminders.addReminder')}</DialogTitle>
          <DialogDescription>
            {reminder ? t('reminders.updateDetails') : t('reminders.setFollowUp')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field name="description" label={t('reminders.description')} value={description} onChange={setDescription} error={errors.description} />
          <Field name="remindAt" label={t('reminders.dueDate')} value={remindAt} onChange={setRemindAt} error={errors.remindAt} type="date" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('reminders.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {reminder ? t('reminders.saveChanges') : t('reminders.addReminderBtn')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
