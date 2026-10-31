"use client"

import type { TaskPriorityDTO, TaskWithAssignmentsDTO } from "@/actions/schemas/task"
import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { combineDateTime } from "@/lib/util/schedule"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { TaskAssigneeSelect } from "./task-assignee-select"
import { TaskPrioritySelect } from "./task-priority-select"

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
  }) => void
  onCancel: () => void
}

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const t = useTranslations()
  const { members } = useProjectContextState()
  const firstAssignment = task?.assignments[0]
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
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("projects.tasks.nameRequired")
    if (startDate && endDate) {
      const start = combineDateTime(startDate, startTime)
      const end = combineDateTime(endDate, endTime)
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
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const start = combineDateTime(startDate, startTime)
    const end = combineDateTime(endDate, endTime)

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cost: cost.trim(),
      priority,
      assigneeIds: assigneeId ? [assigneeId] : [],
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={!!errors.name || undefined}>
          <FieldLabel htmlFor="name">
            {t("projects.tasks.name")}
          </FieldLabel>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name || undefined}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="description">
            {t("common.description")}
          </FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost">{t("common.cost")}</FieldLabel>
          <MoneyInput id="cost" value={cost} onChange={setCost} />
        </Field>
        <Field>
          <FieldLabel htmlFor="priority">
            {t("common.priority")}
          </FieldLabel>
          <TaskPrioritySelect
            id="priority"
            priority={priority}
            onPriorityChange={setPriority}
            fullWidth
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="assignee">
            {t("common.assignee")}
          </FieldLabel>
          <TaskAssigneeSelect
            value={assigneeId}
            onChange={setAssigneeId}
            members={members}
          />
        </Field>
        <Field data-invalid={!!errors.endDate || undefined}>
          <FieldLabel htmlFor="startDate">
            {t("projects.startDate")}
          </FieldLabel>
          <div className="flex gap-3">
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </Field>
        <Field data-invalid={!!errors.endDate || undefined}>
          <FieldLabel htmlFor="endDate">
            {t("common.dueDate")}
          </FieldLabel>
          <div className="flex gap-3">
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={!!errors.endDate || undefined}
            />
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">
            {task
              ? t("common.saveChanges")
              : t("projects.tasks.createTask")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
