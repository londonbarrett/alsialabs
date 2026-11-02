"use client"

import { Dialog } from "@/components/common/dialog"
import { taskPriorityColors } from "@/components/projects/task-priority-select"
import { taskStatusColors } from "@/components/projects/task-status-select"
import { Badge } from "@/components/ui/badge"
import type { CalendarEvent } from "@/lib/calendar"
import { formatWhen } from "@/lib/calendar/util/date"
import type { CalendarEventAssignee, CalendarEventMeta } from "@/lib/types"
import { cn } from "cn"
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { memo } from "react"

interface EventDetailDialogProps {
  event: CalendarEvent | null
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const Row = memo(function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
})

const AssigneeRow = memo(function AssigneeRow({
  assignee,
}: {
  assignee: CalendarEventAssignee
}) {
  const t = useTranslations()
  return (
    <div className="flex flex-col gap-1 py-2 text-sm">
      <div className="flex items-center justify-between gap-4">
        <span>{assignee.name ?? t("common.unassigned")}</span>
        <Badge className={taskStatusColors[assignee.status]}>
          {t(`projects.tasks.status.${assignee.status}`)}
        </Badge>
      </div>
      {assignee.comment && (
        <p className="text-xs text-muted-foreground">
          {assignee.comment}
        </p>
      )}
    </div>
  )
})

function isOverdue(meta: CalendarEventMeta | undefined): boolean {
  if (!meta?.endDateIso || !meta.assignees?.length) return false
  const open = meta.assignees.some(
    (a) => a.status !== "done" && a.status !== "cancelled"
  )
  return open && new Date(meta.endDateIso).getTime() < Date.now()
}

export function EventDetailDialog({
  event,
  locale,
  open,
  onOpenChange,
}: EventDetailDialogProps) {
  const t = useTranslations()

  if (!event) return null

  const meta = event.meta
  const overdue = isOverdue(meta)

  return (
    <Dialog
      title={
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <span>{event.title}</span>
          {meta?.recurrence && (
            <Badge variant="outline" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              {t("projects.tasks.recurring")}
            </Badge>
          )}
        </div>
      }
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <CalendarClock
            className={cn(
              "mt-0.5 size-4 shrink-0",
              overdue ? "text-destructive" : "text-muted-foreground"
            )}
          />
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={
                overdue ? "font-medium text-destructive" : undefined
              }
            >
              {formatWhen(event, locale)}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {t("common.overdue")}
              </span>
            )}
          </span>
        </div>

        <dl className="divide-y">
          <Row
            label={t("common.project")}
            value={meta?.projectName ?? "—"}
          />
          <Row
            label={t("common.owner")}
            value={meta?.projectOwnerName ?? "—"}
          />
          <Row
            label={t("common.priority")}
            value={
              <Badge
                className={
                  meta?.priority ? taskPriorityColors[meta.priority] : ""
                }
              >
                {meta?.priority
                  ? t(`projects.tasks.priority.${meta.priority}`)
                  : t("projects.tasks.priority.none")}
              </Badge>
            }
          />
          {meta?.assignees?.map((assignee, index) => (
            <AssigneeRow
              key={`${assignee.name ?? "assignee"}-${index}`}
              assignee={assignee}
            />
          ))}
        </dl>
      </div>
    </Dialog>
  )
}
