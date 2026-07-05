'use client'

import { Bell, BellOff, CheckCircle2 } from 'lucide-react'
import { ActionMenu } from '@/components/common/action-menu'
import { Button } from '@/components/ui/button'
import type { Reminder } from '@/lib/drizzle/schema'

interface ReminderItemProps {
  reminder: Reminder
  onEdit: () => void
  onDelete: () => Promise<void>
  onComplete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
  canComplete?: boolean
}

export function ReminderItem({ reminder, onEdit, onDelete, onComplete, canEdit, canDelete, canComplete }: ReminderItemProps) {
  const [y, m, d] = reminder.remindAt.split('-')
  const date = `${m}/${d}/${y}`
  const isOverdue = !reminder.completed && new Date(reminder.remindAt) < new Date(new Date().toDateString())

  return (
    <div className={`flex items-start gap-3 py-3 group ${reminder.completed ? 'opacity-60' : ''}`}>
      <div className={`mt-0.5 ${reminder.completed ? 'text-muted-foreground' : isOverdue ? 'text-destructive' : 'text-amber-500'}`}>
        {reminder.completed ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {reminder.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'} — {date}
          </span>
        </div>
        <p className={`text-sm mt-0.5 ${reminder.completed ? 'line-through text-muted-foreground' : ''}`}>
          {reminder.description}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canComplete && !reminder.completed && (
          <Button variant="ghost" size="icon" onClick={onComplete} aria-label="Mark as completed">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </Button>
        )}
        <ActionMenu
          entityName={reminder.description}
          onEdit={onEdit}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    </div>
  )
}
