'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ActivityItem } from '@/components/clients/activity-item'
import { LogActivityDialog } from '@/components/clients/log-activity-dialog'
import { ReminderItem } from '@/components/clients/reminder-item'
import { ReminderDialog } from '@/components/clients/reminder-dialog'
import { deleteActivity } from '@/lib/actions/activities'
import { deleteReminder, completeReminder } from '@/lib/actions/reminders'
import type { Activity, Reminder } from '@/lib/drizzle/schema'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type TimelineEntry = { kind: 'activity' } & Activity | { kind: 'reminder' } & Reminder

interface ActivityTimelineProps {
  clientId: string
  activities: Activity[]
  reminders: Reminder[]
  permissions: string[]
}

export function ActivityTimeline({ clientId, activities, reminders, permissions }: ActivityTimelineProps) {
  const router = useRouter()
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>()
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>()
  const [activityFormKey, setActivityFormKey] = useState(0)
  const [reminderFormKey, setReminderFormKey] = useState(0)

  const entries: TimelineEntry[] = [
    ...activities.map((a) => ({ ...a, kind: 'activity' as const })),
    ...reminders.map((r) => ({ ...r, kind: 'reminder' as const })),
  ].sort((a, b) => {
    const dateA = a.kind === 'activity' ? (a as Activity).activityDate : (a as Reminder).remindAt
    const dateB = b.kind === 'activity' ? (b as Activity).activityDate : (b as Reminder).remindAt
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  function handleSuccess() {
    router.refresh()
  }

  async function handleDeleteActivity(activity: Activity) {
    const result = await deleteActivity(activity.id)
    if (!result.success) toast.error(result.error || 'Failed to delete activity')
    else {
      toast.success('Activity deleted')
      router.refresh()
    }
  }

  async function handleDeleteReminder(reminder: Reminder) {
    const result = await deleteReminder(reminder.id)
    if (!result.success) toast.error(result.error || 'Failed to delete reminder')
    else {
      toast.success('Reminder deleted')
      router.refresh()
    }
  }

  async function handleCompleteReminder(reminder: Reminder) {
    const result = await completeReminder(reminder.id)
    if (!result.success) toast.error(result.error || 'Failed to complete reminder')
    else {
      toast.success('Reminder completed')
      router.refresh()
    }
  }

  const canCreateActivity = permissions.includes('client-activity:create')
  const canEditActivity = permissions.includes('client-activity:edit')
  const canDeleteActivity = permissions.includes('client-activity:delete')
  const canCreateReminder = permissions.includes('client-activity:create')
  const canEditReminder = permissions.includes('client-activity:edit')
  const canDeleteReminder = permissions.includes('client-activity:delete')
  const canCompleteReminder = permissions.includes('client-activity:edit')

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold tracking-tight">Activity</h2>
        <div className="flex gap-2">
          {canCreateActivity && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingActivity(undefined); setLogDialogOpen(true); setActivityFormKey(k => k + 1) }}
            >
              <Plus /> Log Activity
            </Button>
          )}
          {canCreateReminder && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingReminder(undefined); setReminderDialogOpen(true); setReminderFormKey(k => k + 1) }}
            >
              <Plus /> Add Reminder
            </Button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>No activities or reminders yet.</p>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          {entries.map((entry, idx) => (
            <div key={`${entry.kind}-${entry.id}`}>
              {idx > 0 && <Separator />}
              {entry.kind === 'activity' ? (
                <ActivityItem
                  activity={entry}
                  onEdit={() => { setEditingActivity(entry); setLogDialogOpen(true) }}
                  onDelete={() => handleDeleteActivity(entry)}
                  canEdit={canEditActivity}
                  canDelete={canDeleteActivity}
                />
              ) : (
                <ReminderItem
                  reminder={entry}
                  onEdit={() => { setEditingReminder(entry); setReminderDialogOpen(true) }}
                  onDelete={() => handleDeleteReminder(entry)}
                  onComplete={() => handleCompleteReminder(entry)}
                  canEdit={canEditReminder}
                  canDelete={canDeleteReminder}
                  canComplete={canCompleteReminder}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <LogActivityDialog
        key={editingActivity?.id ?? `new-activity-${activityFormKey}`}
        clientId={clientId}
        activity={editingActivity}
        open={logDialogOpen}
        onOpenChange={(open) => { setLogDialogOpen(open); if (!open) setEditingActivity(undefined) }}
        onSuccess={handleSuccess}
      />

      <ReminderDialog
        key={editingReminder?.id ?? `new-reminder-${reminderFormKey}`}
        clientId={clientId}
        reminder={editingReminder}
        open={reminderDialogOpen}
        onOpenChange={(open) => { setReminderDialogOpen(open); if (!open) setEditingReminder(undefined) }}
        onSuccess={handleSuccess}
      />
    </section>
  )
}
