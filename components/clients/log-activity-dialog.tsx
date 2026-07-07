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
import { upsertActivity } from '@/lib/actions/activities'
import type { Activity } from '@/lib/drizzle/schema'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const activityTypes = ['call', 'email', 'meeting', 'note'] as const

interface LogActivityDialogProps {
  clientId: string
  activity?: Activity
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function LogActivityDialog({ clientId, activity, open, onOpenChange, onSuccess }: LogActivityDialogProps) {
  const t = useTranslations()
  const [type, setType] = useState<typeof activityTypes[number]>(activity?.type ?? 'call')
  const [subject, setSubject] = useState(activity?.subject ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [activityDate, setActivityDate] = useState(activity?.activityDate ?? new Date().toISOString().split('T')[0])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!subject.trim()) fieldErrors.subject = t('activities.subjectRequired')
    if (!activityDate)       fieldErrors.activityDate = t('activities.dateRequired')
    else {
      const d = new Date(activityDate + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d > today) fieldErrors.activityDate = t('activities.dateCannotBeFuture')
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const result = await upsertActivity(
        { clientId, type, subject: subject.trim(), description: description.trim(), activityDate },
        activity?.id,
      )
      if (result.success) {
        toast.success(activity ? t('activities.activityUpdated') : t('activities.activityLogged'))
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
          <DialogTitle>{activity ? t('activities.editActivity') : t('activities.logActivity')}</DialogTitle>
          <DialogDescription>
            {activity ? t('activities.updateDetails') : t('activities.recordInteraction')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t('activities.type')}</label>
            <div className="flex gap-2">
              {activityTypes.map((at) => (
                <button
                  key={at}
                  type="button"
                  onClick={() => setType(at)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    type === at
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {t('activities.types.' + at)}
                </button>
              ))}
            </div>
          </div>
          <Field name="subject" label={t('activities.subject')} value={subject} onChange={setSubject} error={errors.subject} />
          <Field name="description" label={t('activities.description')} value={description} onChange={setDescription} type="textarea" />
          <Field name="activityDate" label={t('activities.date')} value={activityDate} onChange={setActivityDate} error={errors.activityDate} type="date" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('activities.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {activity ? t('activities.saveChanges') : t('activities.logActivityBtn')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
