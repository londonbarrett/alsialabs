"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { deleteActivity } from "@/lib/actions/activities"
import type { ClientActivity } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/stores/permissions-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { Calendar, FileText, Mail, Phone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

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
  readOnly?: boolean
}

export function ActivityItem({
  activity,
  clientId,
  readOnly = false,
}: ActivityItemProps) {
  const t = useTranslations("activities")
  const canEdit = useHasPermission("client-activity:edit")
  const canDelete = useHasPermission("client-activity:delete")
  const { run } = useOptimisticAction(useTimelineStore)
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: ClientActivity
  }>({ open: false })

  const Icon = typeIcons[activity.type]
  const iconColor = typeColors[activity.type]
  const [y, m, d] = activity.activityDate.split("-")
  const date = `${m}/${d}/${y}`

  async function handleDelete() {
    const result = await run(
      { type: "remove", kind: "activity", id: activity.id },
      () => deleteActivity(activity.id),
      { key: clientId }
    )
    if (!result.success) {
      toast.error(result.error || t("failedToDelete"))
    } else {
      toast.success(t("activityDeleted"))
    }
  }

  return (
    <>
      <div className="group flex items-start gap-3 py-3">
        <div className={`mt-0.5 ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("types." + activity.type)}
            </span>
            <span className="text-xs text-muted-foreground">
              {date}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium">
            {activity.subject}
          </p>
          {activity.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {activity.description}
            </p>
          )}
        </div>
        {!readOnly && (canEdit || canDelete) && (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <ActionMenu
              entityName={activity.subject}
              onEdit={() =>
                setDialog({ open: true, editing: activity })
              }
              onDelete={handleDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        )}
      </div>
      {!readOnly && (
        <LogActivityDialog
          clientId={clientId}
          open={dialog.open}
          onOpenChange={(o) =>
            setDialog((s) => ({
              open: o,
              editing: o ? s.editing : undefined,
            }))
          }
          activity={dialog.editing}
        />
      )}
    </>
  )
}
