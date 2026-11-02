"use client"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "next-intl"
import { NonRepeatingFields } from "./task-form-non-repeating-fields"
import { RepeatOptions } from "./task-form-repeat-options"
import { RepeatingFields } from "./task-form-repeating-fields"

export interface TaskFormScheduleStepProps {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  repeat: boolean
  recurrence: "daily" | "weekly"
  interval: string
  daysOfWeek: string[]
  occurrenceStartTime: string
  occurrenceEndTime: string
  errors: Record<string, string>
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onRepeatChange: (value: boolean) => void
  onRecurrenceChange: (value: "daily" | "weekly") => void
  onIntervalChange: (value: string) => void
  onDayToggle: (day: string) => void
  onOccurrenceStartTimeChange: (value: string) => void
  onOccurrenceEndTimeChange: (value: string) => void
}

/**
 * Step 2 of the task wizard. The dates live here — a one-off task gets its
 * window, a repeating task its anchor date, optional end date, and occurrence
 * times — with the repeat switch directly below them and the repeat options
 * below that.
 */
export function TaskFormScheduleStep({
  startDate,
  startTime,
  endDate,
  endTime,
  repeat,
  recurrence,
  interval,
  daysOfWeek,
  occurrenceStartTime,
  occurrenceEndTime,
  errors,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onRepeatChange,
  onRecurrenceChange,
  onIntervalChange,
  onDayToggle,
  onOccurrenceStartTimeChange,
  onOccurrenceEndTimeChange,
}: TaskFormScheduleStepProps) {
  const t = useTranslations()

  return (
    <FieldGroup>
      {repeat ? (
        <RepeatingFields
          startDate={startDate}
          endDate={endDate}
          occurrenceStartTime={occurrenceStartTime}
          occurrenceEndTime={occurrenceEndTime}
          errors={errors}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onOccurrenceStartTimeChange={onOccurrenceStartTimeChange}
          onOccurrenceEndTimeChange={onOccurrenceEndTimeChange}
        />
      ) : (
        <NonRepeatingFields
          startDate={startDate}
          startTime={startTime}
          endDate={endDate}
          endTime={endTime}
          errors={errors}
          onStartDateChange={onStartDateChange}
          onStartTimeChange={onStartTimeChange}
          onEndDateChange={onEndDateChange}
          onEndTimeChange={onEndTimeChange}
        />
      )}

      <Field orientation="horizontal">
        <FieldLabel htmlFor="repeat">
          {t("projects.tasks.repeat")}
        </FieldLabel>
        <Switch
          id="repeat"
          checked={repeat}
          onCheckedChange={onRepeatChange}
        />
      </Field>

      {repeat && (
        <RepeatOptions
          recurrence={recurrence}
          interval={interval}
          daysOfWeek={daysOfWeek}
          errors={errors}
          onRecurrenceChange={onRecurrenceChange}
          onIntervalChange={onIntervalChange}
          onDayToggle={onDayToggle}
        />
      )}
    </FieldGroup>
  )
}
