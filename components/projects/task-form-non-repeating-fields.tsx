"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "next-intl"

type NonRepeatingFieldsProps = {
  startTime: string
  endDate: string
  endTime: string
  allDay: boolean
  errors: Record<string, string>
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onAllDayChange: (value: boolean) => void
}

/**
 * One-off scheduling: a due date, then an All-day switch — on by default —
 * that reveals the start/end time window. All-day tasks store midnight
 * timestamps; the start timestamp always equals the due date.
 */
export function NonRepeatingFields({
  startTime,
  endDate,
  endTime,
  allDay,
  errors,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onAllDayChange,
}: NonRepeatingFieldsProps) {
  const t = useTranslations()
  const timeError = errors.startTime || errors.endTime

  return (
    <>
      <Field data-invalid={!!errors.endDate || undefined}>
        <FieldLabel htmlFor="endDate">{t("common.dueDate")}</FieldLabel>
        <Input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          aria-invalid={!!errors.endDate || undefined}
        />
        {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
      </Field>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="allDay">{t("calendar.allDay")}</FieldLabel>
        <Switch
          id="allDay"
          checked={allDay}
          onCheckedChange={onAllDayChange}
        />
      </Field>
      {!allDay && (
        <Field data-invalid={!!timeError || undefined}>
          <div className="flex gap-3">
            <div className="flex w-full flex-col gap-1">
              <FieldLabel htmlFor="windowStartTime">
                {t("common.startTime")}
              </FieldLabel>
              <Input
                id="windowStartTime"
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                aria-invalid={!!errors.startTime || undefined}
              />
            </div>
            <div className="flex w-full flex-col gap-1">
              <FieldLabel htmlFor="windowEndTime">
                {t("common.endTime")}
              </FieldLabel>
              <Input
                id="windowEndTime"
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                aria-invalid={!!errors.endTime || undefined}
              />
            </div>
          </div>
          {timeError && <FieldError>{timeError}</FieldError>}
        </Field>
      )}
    </>
  )
}
