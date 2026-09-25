"use client"

import { Dialog } from "@/components/common/dialog"
import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { upsertActivity } from "@/lib/actions/activities"
import type { ClientActivity } from "@/lib/drizzle/schema"
import { buildTempActivity } from "@/lib/util/temp-entries"
import { useTimelineStore } from "@/stores/timeline-store"
import { cn } from "cn"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

const activityTypes = ["call", "email", "meeting", "note"] as const

interface LogActivityDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  activity?: ClientActivity
}

export function LogActivityDialog({
  clientId,
  open,
  onOpenChange,
  activity,
}: LogActivityDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        activity
          ? t("activities.editActivity")
          : t("activities.logActivity")
      }
      description={
        activity
          ? t("activities.updateDetails")
          : t("activities.recordInteraction")
      }
    >
      <LogActivityForm
        key={open ? (activity?.id ?? "new") : "closed"}
        clientId={clientId}
        activity={activity}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  )
}

function LogActivityForm({
  clientId,
  activity,
  onOpenChange,
}: {
  clientId: string
  activity?: ClientActivity
  onOpenChange: (open: boolean) => void
}) {
  const { run } = useOptimisticAction(useTimelineStore)
  const t = useTranslations()

  const [type, setType] = useState<(typeof activityTypes)[number]>(
    activity?.type ?? "call"
  )
  const [subject, setSubject] = useState(activity?.subject ?? "")
  const [description, setDescription] = useState(
    activity?.description ?? ""
  )
  const [activityDate, setActivityDate] = useState(
    activity?.activityDate ?? new Date().toISOString().split("T")[0]
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!subject.trim())
      fieldErrors.subject = t("activities.subjectRequired")
    if (!activityDate)
      fieldErrors.activityDate = t("activities.dateRequired")
    else {
      const d = new Date(activityDate + "T00:00:00")
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d > today)
        fieldErrors.activityDate = t("activities.dateCannotBeFuture")
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    if (!validate()) return

    const isEdit = !!activity?.id
    const data = {
      clientId,
      type,
      subject: subject.trim(),
      description: description.trim(),
      activityDate,
    }

    // Close optimistically
    onOpenChange(false)

    const action = isEdit
      ? {
          type: "patch" as const,
          kind: "activity" as const,
          id: activity!.id,
          patch: {
            subject: data.subject,
            description: data.description || null,
            type: data.type,
            activityDate: data.activityDate,
          },
        }
      : { type: "add" as const, entry: buildTempActivity(data) }

    const result = await run(
      action,
      () => upsertActivity(data, activity?.id),
      { key: clientId }
    )

    if (result.success) {
      toast.success(
        isEdit
          ? t("activities.activityUpdated")
          : t("activities.activityLogged")
      )
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {t("activities.type")}
        </label>
        <div className="flex gap-2">
          {activityTypes.map((at) => (
            <button
              key={at}
              type="button"
              onClick={() => setType(at)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                type === at
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t("activities.types." + at)}
            </button>
          ))}
        </div>
      </div>
      <Field
        name="subject"
        label={t("activities.subject")}
        value={subject}
        onChange={setSubject}
        error={errors.subject}
      />
      <Field
        name="description"
        label={t("activities.description")}
        value={description}
        onChange={setDescription}
        type="textarea"
      />
      <Field
        name="activityDate"
        label={t("activities.date")}
        value={activityDate}
        onChange={setActivityDate}
        error={errors.activityDate}
        type="date"
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {t("activities.cancel")}
        </Button>
        <Button type="submit">
          {activity
            ? t("activities.saveChanges")
            : t("activities.logActivityBtn")}
        </Button>
      </div>
    </form>
  )
}
