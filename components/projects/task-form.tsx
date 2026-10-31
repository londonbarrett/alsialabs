"use client"

import type {
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/schemas/task"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { combineDateTime } from "@/lib/util/schedule"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { TaskFormDetailsStep } from "./task-form-details-step"
import { TaskFormRepeatStep } from "./task-form-repeat-step"
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
    description: string
    cost: string
    priority: string | null
    assigneeIds: string[]
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
  const firstAssignment = task?.assignments[0]

  const [step, setStep] = useState(1)
  const [step1Done, setStep1Done] = useState(false)
  const [name, setName] = useState(task?.name ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [cost, setCost] = useState(task?.cost ?? "")
  const [priority, setPriority] = useState<TaskPriorityDTO>(
    task?.priority ?? null
  )
  const [assigneeId, setAssigneeId] = useState(
    firstAssignment?.userId ?? ""
  )
  const [startDate, setStartDate] = useState(
    task?.startDate ? toDateInput(task.startDate) : ""
  )
  const [startTime, setStartTime] = useState(
    task?.startDate ? toTimeInput(task.startDate) : ""
  )
  const [endDate, setEndDate] = useState(
    task?.endDate ? toDateInput(task.endDate) : ""
  )
  const [endTime, setEndTime] = useState(
    task?.endDate ? toTimeInput(task.endDate) : ""
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
  const [occurrenceEnd, setOccurrenceEnd] = useState(task?.endTime ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleDay(day: string) {
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    )
  }

  function goNext() {
    if (!name.trim()) {
      setErrors({ name: t("projects.tasks.nameRequired") })
      return
    }
    setErrors({})
    setStep1Done(true)
    setStep(2)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("projects.tasks.nameRequired")

    if (repeat) {
      if (!occurrenceStart)
        fieldErrors.startTime = t("projects.routines.startNotPast")
      if (recurrence === "weekly" && daysOfWeek.length === 0)
        fieldErrors.daysOfWeek = t("projects.routines.atLeastOneDay")
    } else {
      const start = combineDateTime(startDate, startTime)
      const end = combineDateTime(endDate, endTime)
      if (!start) fieldErrors.startDate = t("common.dateRequired")
      if (!end) fieldErrors.endDate = t("common.dateRequired")
      if (start && end && end.getTime() < start.getTime()) {
        fieldErrors.endDate = t("projects.routines.endBeforeStart")
      } else if (
        start &&
        end &&
        start.toDateString() !== end.toDateString()
      ) {
        fieldErrors.endDate = t("projects.routines.endBeforeStart")
      }
    }

    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    const start = combineDateTime(startDate, startTime)
    const end = combineDateTime(endDate, endTime)

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cost: cost.trim(),
      priority,
      assigneeIds: assigneeId ? [assigneeId] : [],
      startDate: repeat || !start ? null : start.toISOString(),
      endDate: repeat || !end ? null : end.toISOString(),
      recurrence: repeat ? recurrence : null,
      interval: Number(interval) || 1,
      daysOfWeek: repeat ? daysOfWeek : [],
      startTime: repeat ? occurrenceStart : "",
      endTime: repeat ? occurrenceEnd : "",
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <TaskStepIndicator
        current={step}
        editMode={Boolean(task)}
        step1Done={step1Done}
        onSelect={setStep}
      />

      {step === 1 ? (
        <TaskFormDetailsStep
          name={name}
          description={description}
          cost={cost}
          priority={priority}
          assigneeId={assigneeId}
          startDate={startDate}
          startTime={startTime}
          endDate={endDate}
          endTime={endTime}
          members={members}
          errors={errors}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCostChange={setCost}
          onPriorityChange={setPriority}
          onAssigneeChange={setAssigneeId}
          onStartDateChange={setStartDate}
          onStartTimeChange={setStartTime}
          onEndDateChange={setEndDate}
          onEndTimeChange={setEndTime}
          onNext={goNext}
          onCancel={onCancel}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <TaskFormRepeatStep
            repeat={repeat}
            recurrence={recurrence}
            interval={interval}
            daysOfWeek={daysOfWeek}
            startTime={occurrenceStart}
            endTime={occurrenceEnd}
            onRepeatChange={setRepeat}
            onRecurrenceChange={setRecurrence}
            onIntervalChange={setInterval}
            onDayToggle={toggleDay}
            onStartTimeChange={setOccurrenceStart}
            onEndTimeChange={setOccurrenceEnd}
          />
          {(errors.startTime || errors.daysOfWeek) && (
            <FieldError>
              {errors.startTime ?? errors.daysOfWeek}
            </FieldError>
          )}
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
