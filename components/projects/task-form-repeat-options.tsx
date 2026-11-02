"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WEEKDAYS } from "@/lib/util/schedule"
import { useTranslations } from "next-intl"

type RepeatOptionsProps = {
  recurrence: "daily" | "weekly"
  interval: string
  daysOfWeek: string[]
  errors: Record<string, string>
  onRecurrenceChange: (value: "daily" | "weekly") => void
  onIntervalChange: (value: string) => void
  onDayToggle: (day: string) => void
}

/** What makes the schedule repeat: frequency, interval, and weekdays. */
export function RepeatOptions({
  recurrence,
  interval,
  daysOfWeek,
  errors,
  onRecurrenceChange,
  onIntervalChange,
  onDayToggle,
}: RepeatOptionsProps) {
  const t = useTranslations()

  return (
    <>
      <Field>
        <FieldLabel htmlFor="recurrence">
          {t("projects.routines.recurrenceLabel")}
        </FieldLabel>
        <Select
          value={recurrence}
          onValueChange={(v) =>
            onRecurrenceChange(v === "daily" ? "daily" : "weekly")
          }
          items={[
            {
              value: "daily",
              label: t("projects.routines.recurrence.daily"),
            },
            {
              value: "weekly",
              label: t("projects.routines.recurrence.weekly"),
            },
          ]}
        >
          <SelectTrigger id="recurrence" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">
              {t("projects.routines.recurrence.daily")}
            </SelectItem>
            <SelectItem value="weekly">
              {t("projects.routines.recurrence.weekly")}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="interval">
          {t("projects.routines.intervalLabel")}
        </FieldLabel>
        <Input
          id="interval"
          type="number"
          min={1}
          max={365}
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
        />
      </Field>

      {recurrence === "weekly" && (
        <Field data-invalid={!!errors.daysOfWeek || undefined}>
          <FieldLabel>
            {t("projects.routines.weekdaysLabel")}
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onDayToggle(day)}
                className={
                  daysOfWeek.includes(day)
                    ? "rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    : "rounded-md bg-muted px-2 py-1 text-xs"
                }
              >
                {t(`projects.routines.dayShort.${day}`)}
              </button>
            ))}
          </div>
          {errors.daysOfWeek && (
            <FieldError>{errors.daysOfWeek}</FieldError>
          )}
        </Field>
      )}
    </>
  )
}
