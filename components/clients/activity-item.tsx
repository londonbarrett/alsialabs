"use client"

import { ActionMenu } from "@/components/common/action-menu"
import type { ClientActivity } from "@/lib/drizzle/schema"
import { Calendar, FileText, Mail, Phone } from "lucide-react"
import { useTranslations } from "next-intl"

const typeIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
}

const typeColors = {
  call: "text-blue-500",
  email: "text-purple-500",
  meeting: "text-amber-500",
  note: "text-emerald-500",
}

interface ActivityItemProps {
  activity: ClientActivity
  onEdit: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
}

export function ActivityItem({
  activity,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: ActivityItemProps) {
  const t = useTranslations("activities")
  const Icon = typeIcons[activity.type]
  const iconColor = typeColors[activity.type]
  const [y, m, d] = activity.activityDate.split("-")
  const date = `${m}/${d}/${y}`

  return (
    <div className="group flex items-start gap-3 py-3">
      <div className={`mt-0.5 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t("types." + activity.type)}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="mt-0.5 text-sm font-medium">{activity.subject}</p>
        {activity.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {activity.description}
          </p>
        )}
      </div>
      {(canEdit || canDelete) && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <ActionMenu
            entityName={activity.subject}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      )}
    </div>
  )
}
