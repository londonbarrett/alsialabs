'use client'

import { useState } from 'react'
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
import type { Reminder } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ReminderDialogProps {
  clientId: string
  reminder?: Reminder
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ReminderDialog({ clientId, reminder, open, onOpenChange, onSuccess }: ReminderDialogProps) {
  const [description, setDescription] = useState(reminder?.description ?? '')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [remindAt, setRemindAt] = useState(reminder?.remindAt ?? tomorrow.toISOString().split('T')[0])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim()) fieldErrors.description = 'Description is required'
    if (!remindAt) fieldErrors.remindAt = 'Date is required'
    else {
      const d = new Date(remindAt + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d < today) fieldErrors.remindAt = 'Date must be today or in the future'
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
        toast.success(reminder ? 'Reminder updated' : 'Reminder created')
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
        toast.error(result.error || 'Something went wrong')
      }
    } catch {
      toast.error('Something went wrong')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{reminder ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
          <DialogDescription>
            {reminder ? 'Update the reminder details below.' : 'Set a follow-up reminder for this client.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field name="description" label="Description" value={description} onChange={setDescription} error={errors.description} />
          <Field name="remindAt" label="Due Date" value={remindAt} onChange={setRemindAt} error={errors.remindAt} type="date" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {reminder ? 'Save Changes' : 'Add Reminder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
