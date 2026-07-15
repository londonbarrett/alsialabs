'use client'

import { useTranslations } from 'next-intl'
import { Phone, Mail, Calendar, FileText } from 'lucide-react'
import { ActionMenu } from '@/components/common/action-menu'
import type { ClientActivity } from '@/lib/drizzle/schema'

const typeIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
}

const typeColors = {
  call: 'text-blue-500',
  email: 'text-purple-500',
  meeting: 'text-amber-500',
  note: 'text-emerald-500',
}

interface ActivityItemProps {
  activity: ClientActivity
  onEdit: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
}

export function ActivityItem({ activity, onEdit, onDelete, canEdit, canDelete }: ActivityItemProps) {
  const t = useTranslations('activities')
  const Icon = typeIcons[activity.type]
  const iconColor = typeColors[activity.type]
  const [y, m, d] = activity.activityDate.split('-')
  const date = `${m}/${d}/${y}`

  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className={`mt-0.5 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('types.' + activity.type)}</span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="text-sm font-medium mt-0.5">{activity.subject}</p>
        {activity.description && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionMenu
          entityName={activity.subject}
          onEdit={onEdit}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    </div>
  )
}
