"use client"

import { Dialog } from "@/components/common/dialog"
import { Money } from "@/components/common/money"
import { RoutineScheduleSummary } from "@/components/projects/routines/routine-schedule-summary"
import { taskPriorityColors } from "@/components/projects/task-priority-select"
import { taskStatusColors } from "@/components/projects/task-status-select"
import { Badge } from "@/components/ui/badge"
import type { CalendarEvent, CalendarEventMeta } from "@/lib/calendar"
import { cn, isTaskOverdue } from "@/lib/util/utils"
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { memo } from "react"

interface EventDetailDialogProps {
  event: CalendarEvent | null
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatWhen(event: CalendarEvent, locale: string) {
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  })
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  })

  if (event.allDay) return dateFmt.format(event.start)

  const start = `${dateFmt.format(event.start)} · ${timeFmt.format(
    event.start
  )}`
  if (event.end.getTime() !== event.start.getTime()) {
    return `${start} – ${timeFmt.format(event.end)}`
  }
  return start
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

const BaseRows = memo(function BaseRows({
  meta,
}: {
  meta: CalendarEventMeta | undefined
}) {
  const t = useTranslations()
  return (
    <>
      <Row
        label={t("calendar.project")}
        value={meta?.projectName ?? "—"}
      />
      <Row
        label={t("calendar.owner")}
        value={meta?.projectOwnerName ?? "—"}
      />
      <Row
        label={t("calendar.responsible")}
        value={
          meta?.assigneeName
            ? meta.assigneeName
            : t("projects.tasks.unassigned")
        }
      />
    </>
  )
})

export function EventDetailDialog({
  event,
  locale,
  open,
  onOpenChange,
}: EventDetailDialogProps) {
  const t = useTranslations()

  if (!event) return null

  const meta = event.meta
  const isTask = meta?.kind === "task"
  const isRoutine = meta?.kind === "routine"
  const overdue =
    isTask && meta?.status && meta?.dueDateIso
      ? isTaskOverdue(meta.status, meta.dueDateIso)
      : false

  return (
    <Dialog
      title={
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <span>{event.title}</span>
          {isRoutine ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              {t("projects.routines.routine")}
            </Badge>
          ) : isTask && meta?.status ? (
            <Badge className={taskStatusColors[meta.status]}>
              {t(`projects.tasks.status.${meta.status}`)}
            </Badge>
          ) : null}
        </div>
      }
      description={meta?.description ? meta.description : undefined}
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
                {t("projects.tasks.overdue")}
              </span>
            )}
          </span>
        </div>

        {isTask || isRoutine ? (
          <dl className="divide-y">
            <BaseRows meta={meta} />
            {isTask ? (
              <Row
                label={t("calendar.priority")}
                value={
                  <Badge
                    className={
                      meta?.priority
                        ? taskPriorityColors[meta.priority]
                        : ""
                    }
                  >
                    {meta?.priority
                      ? t(`projects.tasks.priority.${meta.priority}`)
                      : t("projects.tasks.priority.none")}
                  </Badge>
                }
              />
            ) : isRoutine ? (
              <Row
                label={t("projects.routines.recurrenceLabel")}
                value={<RoutineScheduleSummary routine={meta} />}
              />
            ) : null}
            {meta?.cost ? (
              <Row
                label={t("calendar.cost")}
                value={<Money value={meta.cost} />}
              />
            ) : null}
          </dl>
        ) : null}
      </div>
    </Dialog>
  )
}
