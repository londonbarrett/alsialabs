"use client"

import {
  Field,
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
import { Switch } from "@/components/ui/switch"
import { WEEKDAYS } from "@/lib/util/schedule"
import { useTranslations } from "next-intl"

export function TaskFormRepeatStep({
  repeat,
  recurrence,
  interval,
  daysOfWeek,
  startTime,
  endTime,
  onRepeatChange,
  onRecurrenceChange,
  onIntervalChange,
  onDayToggle,
  onStartTimeChange,
  onEndTimeChange,
}: {
  repeat: boolean
  recurrence: "daily" | "weekly"
  interval: string
  daysOfWeek: string[]
  startTime: string
  endTime: string
  onRepeatChange: (value: boolean) => void
  onRecurrenceChange: (value: "daily" | "weekly") => void
  onIntervalChange: (value: string) => void
  onDayToggle: (day: string) => void
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
}) {
  const t = useTranslations()

  return (
    <FieldGroup>
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
                { value: "daily", label: t("projects.routines.recurrence.daily") },
                { value: "weekly", label: t("projects.routines.recurrence.weekly") },
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
            <Field>
              <FieldLabel>{t("projects.routines.weekdaysLabel")}</FieldLabel>
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
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="startTime">
              {t("projects.routines.performAt")}
            </FieldLabel>
            <div className="flex gap-3">
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
              />
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
              />
            </div>
          </Field>
        </>
      )}
    </FieldGroup>
  )
}
