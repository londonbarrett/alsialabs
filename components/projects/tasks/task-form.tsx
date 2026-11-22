"use client"

import type {
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { Button } from "@/components/ui/button"
import {
  validateRepeatingWindow,
  validateTaskDetails,
  validateTaskName,
} from "@/lib/tasks/form-validation"
import type {
  TaskDetailsIssue,
  TaskDetailsValues,
} from "@/lib/tasks/form-validation"
import { costToNumber } from "@/lib/tasks/cost"
import { combineDateTime } from "@/lib/util/schedule"
import { isAllDayDate } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { TaskFormDetailsStep } from "./task-form-details-step"
import { TaskFormScheduleStep } from "./task-form-schedule-step"
import { TaskStepIndicator } from "./task-step-indicator"

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

interface TaskFormProps {
  task?: TaskWithAssignmentsDTO
  onSubmit: (data: {
    name: string
    cost: string
    description: string
    priority: string | null
    assigneeIds: string[]
    unassignAs: Record<string, "done" | "cancelled">
    startDate: string | null
    endDate: string | null
    recurrence: "daily" | "weekly" | null
    interval: number
    daysOfWeek: string[]
    startTime: string
    endTime: string
  }) => void
  onCancel: () => void
}

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const t = useTranslations()
  const { members } = useProjectContextState()

  const [step, setStep] = useState(1)
  const [step1Done, setStep1Done] = useState(false)
  const [name, setName] = useState(task?.name ?? "")
  const [cost, setCost] = useState(
    task?.cost ? String(costToNumber(task.cost)) : ""
  )
  const [description, setDescription] = useState(
    task?.description ?? ""
  )
  const [priority, setPriority] = useState<TaskPriorityDTO>(
    task?.priority ?? null
  )
  // Current members on the task's assignee roster: the initial selection
  // and the set whose removal needs the disposition dialog. Computed once
  // from the task prop — the roster (not open rows) is the source, so a
  // zero-open task still shows its assignees, and a roster user who left
  // the project is dropped here so it can never travel in the payload as
  // an unrenderable chip.
  const protectedIds = useMemo(
    () =>
      task
        ? task.assigneeIds.filter((userId) =>
            members.some((m) => m.userId === userId)
          )
        : [],
    [task, members]
  )
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    () => protectedIds
  )
  const [removedDispositions, setRemovedDispositions] = useState<
    Record<string, "done" | "cancelled">
  >({})
  // All-day is the default; editing derives it from stored times (a
  // repeating task's occurrence time, a one-off's timestamp times).
  const [allDay, setAllDay] = useState(() => {
    if (!task) return true
    if (task.recurrence) return !task.startTime
    return (
      (!task.startDate || isAllDayDate(task.startDate)) &&
      (!task.endDate || isAllDayDate(task.endDate))
    )
  })
  const [startDate, setStartDate] = useState(
    task?.startDate
      ? toDateInput(task.startDate)
      : task?.recurrence
        ? // Repeating work without a stored anchor begins today.
          toDateInput(new Date())
        : ""
  )
  const [startTime, setStartTime] = useState(
    allDay ? "" : task?.startDate ? toTimeInput(task.startDate) : ""
  )
  const [endDate, setEndDate] = useState(
    task?.endDate ? toDateInput(task.endDate) : ""
  )
  const [endTime, setEndTime] = useState(
    allDay ? "" : task?.endDate ? toTimeInput(task.endDate) : ""
  )
  const [repeat, setRepeat] = useState(Boolean(task?.recurrence))
  const [recurrence, setRecurrence] = useState<"daily" | "weekly">(
    task?.recurrence === "daily" ? "daily" : "weekly"
  )
  const [interval, setInterval] = useState(String(task?.interval ?? 1))
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(
    task?.daysOfWeek ?? []
  )
  const [occurrenceStart, setOccurrenceStart] = useState(
    task?.startTime ?? ""
  )
  const [occurrenceEnd, setOccurrenceEnd] = useState(
    task?.endTime ?? ""
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleDay(day: string) {
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    )
  }

  function recordDisposition(
    userId: string,
    disposition: "done" | "cancelled"
  ) {
    setRemovedDispositions((prev) => ({
      ...prev,
      [userId]: disposition,
    }))
  }

  function mapDetailsIssues(issues: TaskDetailsIssue[]) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of issues) {
      if (issue === "NAME_REQUIRED") {
        fieldErrors.name = t("projects.tasks.nameRequired")
      } else if (issue === "START_DATE_REQUIRED") {
        fieldErrors.startDate = t("common.dateRequired")
      } else if (issue === "END_DATE_REQUIRED") {
        fieldErrors.endDate = t("common.dateRequired")
      } else if (issue === "START_TIME_REQUIRED") {
        fieldErrors.startTime = t("common.timeRequired")
      } else if (issue === "END_TIME_REQUIRED") {
        fieldErrors.endTime = t("common.timeRequired")
      } else {
        fieldErrors.endDate = t("projects.routines.endBeforeStart")
      }
    }
    return fieldErrors
  }

  /**
   * The schedule step stays locked until step 1 is clean — a name is always
   * required, and a window that was started must be a complete, same-day one.
   * An untouched window may pass: a repeating task fills it later or never.
   */
  function goNext() {
    // The schedule step owns the dates now, so only the details step's own
    // fields gate the transition.
    const issues = validateTaskName(name)
    if (issues.length > 0) {
      setErrors(mapDetailsIssues(issues))
      return
    }
    setErrors({})
    setStep1Done(true)
    setStep(2)
  }

  function handleRepeatChange(value: boolean) {
    setRepeat(value)
    setErrors({})
    if (value && !startDate) setStartDate(toDateInput(new Date()))
  }

  function handleAllDayChange(value: boolean) {
    setAllDay(value)
    setErrors({})
  }

  function handleStepSelect(n: number) {
    if (n === 2) {
      goNext()
      return
    }
    setStep(n)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const effectiveStartDate =
      repeat && !startDate ? toDateInput(new Date()) : startDate
    // The All-day switch owns the times: on, they travel as empty strings
    // (midnight timestamps, null occurrence times); off, they are submitted
    // and validated as entered.
    const winStart = allDay ? "" : startTime
    const winEnd = allDay ? "" : endTime
    const occStart = allDay ? "" : occurrenceStart
    const occEnd = allDay ? "" : occurrenceEnd
    // A non-repeating task lives on one day: its start date is the due date,
    // so the hidden field never diverges (legacy multi-day rows normalize on
    // save) and validation always sees a same-day window.
    const nonRepeatingValues: TaskDetailsValues = {
      name,
      startDate: endDate,
      startTime: winStart,
      endDate,
      endTime: winEnd,
    }
    const issues = repeat
      ? [
          ...validateTaskName(name),
          ...validateRepeatingWindow({
            startDate: effectiveStartDate,
            endDate,
          }),
        ]
      : validateTaskDetails(nonRepeatingValues, {
          requireWindow: true,
        })
    const fieldErrors = mapDetailsIssues(issues)

    // Off the All-day switch the times are the point of the mode: both are
    // required, in either branch. All-day submits empty times and demands none.
    if (!allDay) {
      if (repeat) {
        if (!occurrenceStart)
          fieldErrors.startTime = t("common.timeRequired")
        if (!occurrenceEnd)
          fieldErrors.endTime = t("common.timeRequired")
      } else {
        if (!startTime) fieldErrors.startTime = t("common.timeRequired")
        if (!endTime) fieldErrors.endTime = t("common.timeRequired")
      }
    }
    if (repeat) {
      if (recurrence === "weekly" && daysOfWeek.length === 0)
        fieldErrors.daysOfWeek = t("projects.routines.atLeastOneDay")
    }

    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      // The name lives on step 1 — bounce back so its message is visible;
      // window errors already render in place on the schedule step.
      if (issues.includes("NAME_REQUIRED")) setStep(1)
      return
    }

    // Repeating work is anchored from its start date (today when the user
    // never picked one); its optional end date bounds the schedule — each
    // occurrence's own window still comes from the schedule. A non-repeating
    // task's start timestamp falls on the due date.
    const start = combineDateTime(
      repeat ? effectiveStartDate : endDate,
      repeat ? occStart : winStart
    )
    const repeatEnd = combineDateTime(endDate, occEnd)
    const end = combineDateTime(endDate, winEnd)

    onSubmit({
      name: name.trim(),
      cost,
      description: description.trim(),
      priority,
      assigneeIds,
      unassignAs: removedDispositions,
      startDate: start ? start.toISOString() : null,
      endDate: repeat
        ? repeatEnd
          ? repeatEnd.toISOString()
          : null
        : end
          ? end.toISOString()
          : null,
      recurrence: repeat ? recurrence : null,
      interval: Number(interval) || 1,
      daysOfWeek: repeat ? daysOfWeek : [],
      startTime: repeat ? occStart : "",
      endTime: repeat ? occEnd : "",
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <TaskStepIndicator
        current={step}
        editMode={Boolean(task)}
        step1Done={step1Done}
        onSelect={handleStepSelect}
      />

      {step === 1 ? (
        <TaskFormDetailsStep
          name={name}
          cost={cost}
          description={description}
          priority={priority}
          assigneeIds={assigneeIds}
          members={members}
          protectedIds={protectedIds}
          errors={errors}
          onNameChange={setName}
          onCostChange={setCost}
          onDescriptionChange={setDescription}
          onPriorityChange={setPriority}
          onAssigneeChange={setAssigneeIds}
          onRemoveDisposition={recordDisposition}
          onNext={goNext}
          onCancel={onCancel}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <TaskFormScheduleStep
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            allDay={allDay}
            repeat={repeat}
            recurrence={recurrence}
            interval={interval}
            daysOfWeek={daysOfWeek}
            occurrenceStartTime={occurrenceStart}
            occurrenceEndTime={occurrenceEnd}
            errors={errors}
            onStartDateChange={setStartDate}
            onStartTimeChange={setStartTime}
            onEndDateChange={setEndDate}
            onEndTimeChange={setEndTime}
            onAllDayChange={handleAllDayChange}
            onRepeatChange={handleRepeatChange}
            onRecurrenceChange={setRecurrence}
            onIntervalChange={setInterval}
            onDayToggle={toggleDay}
            onOccurrenceStartTimeChange={setOccurrenceStart}
            onOccurrenceEndTimeChange={setOccurrenceEnd}
          />
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
            >
              {t("common.back")}
            </Button>
            <Button type="submit">
              {task
                ? t("common.saveChanges")
                : t("projects.tasks.createTask")}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
