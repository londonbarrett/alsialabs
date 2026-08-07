"use client"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  parseISODate,
  startOfDay,
  WEEKDAYS,
} from "@/lib/routines/schedule"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface RoutineScheduleStepProps {
  isEdit: boolean
  name: string
  recurrence: string
  interval: string
  daysOfWeek: string[]
  time: string
  startDate: string
  endDate: string
  onRecurrenceChange: (value: string) => void
  onIntervalChange: (value: string) => void
  onDayToggle: (day: string) => void
  onTimeChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onSubmit: () => void
  onBack: () => void
}

export function RoutineScheduleStep({
  isEdit,
  name,
  recurrence,
  interval,
  daysOfWeek,
  time,
  startDate,
  endDate,
  onRecurrenceChange,
  onIntervalChange,
  onDayToggle,
  onTimeChange,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
  onBack,
}: RoutineScheduleStepProps) {
  const t = useTranslations()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fieldErrors: Record<string, string> = {}
    if (!name.trim())
      fieldErrors.name = t("projects.routines.nameRequired")
    if (recurrence === "weekly" && daysOfWeek.length === 0)
      fieldErrors.daysOfWeek = t("projects.routines.atLeastOneDay")
    if (!isEdit) {
      const today = startOfDay(new Date())
      if (startDate && parseISODate(startDate) < today)
        fieldErrors.startDate = t("projects.routines.startNotPast")
      if (endDate && parseISODate(endDate) <= today)
        fieldErrors.endDate = t("projects.routines.endFuture")
    }
    if (startDate && endDate && endDate < startDate)
      fieldErrors.endDate = t("projects.routines.endBeforeStart")
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length === 0) onSubmit()
  }

  const intervalUnit =
    recurrence === "daily"
      ? interval === "1"
        ? t("projects.routines.day")
        : t("projects.routines.days")
      : interval === "1"
        ? t("projects.routines.week")
        : t("projects.routines.weeks")

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="recurrence">
            {t("projects.routines.recurrenceLabel")}
          </FieldLabel>
          <Select value={recurrence} onValueChange={onRecurrenceChange}>
            <SelectTrigger id="recurrence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["daily", "weekly"] as const).map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`projects.routines.recurrence.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {recurrence === "daily" && (
          <Field>
            <FieldLabel htmlFor="interval">
              {t("projects.routines.intervalLabel")}
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="interval"
                type="number"
                min={1}
                max={365}
                value={interval}
                onChange={(e) => onIntervalChange(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                {intervalUnit}
              </span>
            </div>
          </Field>
        )}

        {recurrence === "weekly" && (
          <>
            <Field data-invalid={!!errors.daysOfWeek || undefined}>
              <FieldLabel>
                {t("projects.routines.weekdaysLabel")}
              </FieldLabel>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const selected = daysOfWeek.includes(day)
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      onClick={() => onDayToggle(day)}
                    >
                      {t(`projects.routines.dayShort.${day}`)}
                    </Button>
                  )
                })}
              </div>
              {errors.daysOfWeek && (
                <FieldError>{errors.daysOfWeek}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="interval">
                {t("projects.routines.intervalLabel")}
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  max={52}
                  value={interval}
                  onChange={(e) => onIntervalChange(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {intervalUnit}
                </span>
              </div>
            </Field>
          </>
        )}

        <Field>
          <FieldLabel htmlFor="time">
            {t("projects.routines.performAt")}
          </FieldLabel>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.startDate || undefined}>
            <FieldLabel htmlFor="startDate">
              {t("projects.routines.startDate")}
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
            <FieldLabel htmlFor="endDate">
              {t("projects.routines.endDate")}
            </FieldLabel>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              aria-invalid={!!errors.endDate || undefined}
            />
            {errors.endDate && (
              <FieldError>{errors.endDate}</FieldError>
            )}
          </Field>
        </div>

        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}

        <Field orientation="horizontal">
          <Button type="button" variant="outline" onClick={onBack}>
            {t("common.back")}
          </Button>
          <Button type="submit">
            {isEdit
              ? t("common.saveChanges")
              : t("projects.routines.createRoutine")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
