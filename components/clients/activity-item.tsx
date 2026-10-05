"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import type { ClientActivity } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/components/common/permissions-provider"
import { useTimelineActions } from "@/stores/use-timeline-actions"
import { Calendar, FileText, Mail, Phone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
  clientId: string
}

/**
 * An activity row on the client detail timeline. Requires `TimelineProvider`,
 * which that page mounts. The activity page renders its rows with
 * `ActivityEntryRow` instead, since it has no timeline store.
 */
export function ActivityItem({
  activity,
  clientId,
}: ActivityItemProps) {
  const { createActivity, updateActivity, deleteActivity } =
    useTimelineActions()
  const canEdit = useHasPermission("client-activity:edit")
  const canDelete = useHasPermission("client-activity:delete")
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: ClientActivity
  }>({ open: false })

  return (
    <>
      <ActivityRow
        activity={activity}
        menu={
          canEdit || canDelete ? (
            <ActionMenu
              entityName={activity.subject}
              onEdit={() =>
                setDialog({ open: true, editing: activity })
              }
              onDelete={() => deleteActivity(activity.id)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ) : null
        }
      />
      <LogActivityDialog
        clientId={clientId}
        open={dialog.open}
        onSubmit={(data, editingId) =>
          editingId
            ? updateActivity(data, editingId)
            : createActivity(data)
        }
        onOpenChange={(o) =>
          setDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        activity={dialog.editing}
      />
    </>
  )
}

function ActivityRow({
  activity,
  menu,
}: {
  activity: ClientActivity
  menu?: React.ReactNode
}) {
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
      {menu && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          {menu}
        </div>
      )}
    </div>
  )
}
