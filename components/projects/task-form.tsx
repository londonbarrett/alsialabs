"use client"

import { MoneyInput } from "@/components/common/money-input"
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
import { Textarea } from "@/components/ui/textarea"
import type { Task } from "@/lib/drizzle/schema"
import { combineDateTime } from "@/lib/routines/schedule"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { TaskPrioritySelect } from "./task-priority-select"
import { TaskStatusSelect } from "./task-status-select"

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

function toDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`
}

interface TaskFormProps {
  task?: Task
  projectMembers: ProjectMember[]
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    status: string
    priority: string | null
    dueDate: string | null
    assigneeId: string | null
  }) => Promise<{
    success: boolean
    fieldErrors?: Record<string, string[]>
    error?: string
  }>
  onCancel: () => void
}

const taskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const

export function TaskForm({
  task,
  projectMembers,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const t = useTranslations()
  const [name, setName] = useState(task?.name ?? "")
  const [description, setDescription] = useState(
    task?.description ?? ""
  )
  const [cost, setCost] = useState(task?.cost ?? "")
  const [status, setStatus] = useState<string>(task?.status ?? "todo")
  const [priority, setPriority] = useState<string | null>(
    task?.priority ?? null
  )
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? toDateInput(task.dueDate) : ""
  )
  const [dueTime, setDueTime] = useState(
    task?.dueDate ? toTimeInput(task.dueDate) : ""
  )
  const [assigneeId, setAssigneeId] = useState<string>(
    task?.assigneeId ?? ""
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim())
      fieldErrors.name = t("projects.tasks.nameRequired")
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const combinedDueDate = combineDateTime(dueDate, dueTime)

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cost: cost.trim(),
      status,
      priority,
      dueDate: combinedDueDate ? combinedDueDate.toISOString() : null,
      assigneeId: assigneeId || null,
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
        <Field data-invalid={!!errors.description || undefined}>
          <FieldLabel htmlFor="description">
            {t("projects.tasks.description")}
          </FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description || undefined}
          />
          {errors.description && (
            <FieldError>{errors.description}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!errors.cost || undefined}>
          <FieldLabel htmlFor="cost">
            {t("projects.tasks.cost")}
          </FieldLabel>
          <MoneyInput
            id="cost"
            value={cost}
            onChange={setCost}
            aria-invalid={!!errors.cost || undefined}
          />
          {errors.cost && <FieldError>{errors.cost}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="status">
            {t("projects.tasks.statusLabel")}
          </FieldLabel>
          <TaskStatusSelect
            id="status"
            status={status}
            allowedStatuses={taskStatuses}
            onStatusChange={setStatus}
            fullWidth
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="priority">
            {t("projects.tasks.priorityLabel")}
          </FieldLabel>
          <TaskPrioritySelect
            id="priority"
            priority={priority}
            onPriorityChange={setPriority}
            fullWidth
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dueDate">
            {t("projects.tasks.dueDate")}
          </FieldLabel>
          <div className="flex gap-3">
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              id="dueTime"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="assignee">
            {t("projects.tasks.assignee")}
          </FieldLabel>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger id="assignee" className="w-full">
              <SelectValue
                placeholder={t("projects.tasks.unassigned")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                {t("projects.tasks.unassigned")}
              </SelectItem>
              {projectMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.userName || m.userEmail || m.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
