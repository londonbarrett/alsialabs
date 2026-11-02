"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"

type RepeatingFieldsProps = {
  startDate: string
  endDate: string
  occurrenceStartTime: string
  occurrenceEndTime: string
  errors: Record<string, string>
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onOccurrenceStartTimeChange: (value: string) => void
  onOccurrenceEndTimeChange: (value: string) => void
}

/**
 * Repeating scheduling: the anchor date (the form defaults it to today), the
 * optional date the schedule ends on, and the time each occurrence runs.
 */
export function RepeatingFields({
  startDate,
  endDate,
  occurrenceStartTime,
  occurrenceEndTime,
  errors,
  onStartDateChange,
  onEndDateChange,
  onOccurrenceStartTimeChange,
  onOccurrenceEndTimeChange,
}: RepeatingFieldsProps) {
  const t = useTranslations()

  return (
    <>
      <Field data-invalid={!!errors.startDate || undefined}>
        <FieldLabel htmlFor="startDate">
          {t("projects.startDate")}
        </FieldLabel>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          aria-invalid={!!errors.startDate || undefined}
        />
        {errors.startDate && (
          <FieldError>{errors.startDate}</FieldError>
        )}
      </Field>
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
      <Field data-invalid={!!errors.startTime || undefined}>
        <FieldLabel htmlFor="startTime">
          {t("projects.routines.performAt")}
        </FieldLabel>
        <div className="flex gap-3">
          <Input
            id="startTime"
            type="time"
            value={occurrenceStartTime}
            onChange={(e) =>
              onOccurrenceStartTimeChange(e.target.value)
            }
            aria-invalid={!!errors.startTime || undefined}
          />
          <Input
            id="endTime"
            type="time"
            value={occurrenceEndTime}
            onChange={(e) => onOccurrenceEndTimeChange(e.target.value)}
          />
        </div>
        {errors.startTime && (
          <FieldError>{errors.startTime}</FieldError>
        )}
      </Field>
    </>
  )
}
