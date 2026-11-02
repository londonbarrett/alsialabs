"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"

type NonRepeatingFieldsProps = {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  errors: Record<string, string>
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
}

/**
 * One-off scheduling: a start/due window with times — the whole point of the
 * date pair, shown as-is.
 */
export function NonRepeatingFields({
  startDate,
  startTime,
  endDate,
  endTime,
  errors,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
}: NonRepeatingFieldsProps) {
  const t = useTranslations()

  return (
    <>
      <Field data-invalid={!!errors.startDate || undefined}>
        <FieldLabel htmlFor="startDate">
          {t("projects.startDate")}
        </FieldLabel>
        <div className="flex gap-3">
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            aria-invalid={!!errors.startDate || undefined}
          />
          <Input
            id="windowStartTime"
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
          />
        </div>
        {errors.startDate && (
          <FieldError>{errors.startDate}</FieldError>
        )}
      </Field>
      <Field data-invalid={!!errors.endDate || undefined}>
        <FieldLabel htmlFor="endDate">{t("common.dueDate")}</FieldLabel>
        <div className="flex gap-3">
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            aria-invalid={!!errors.endDate || undefined}
          />
          <Input
            id="windowEndTime"
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
          />
        </div>
        {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
      </Field>
    </>
  )
}
