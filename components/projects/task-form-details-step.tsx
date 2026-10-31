"use client"

import type { TaskPriorityDTO } from "@/actions/schemas/task"
import type { ProjectMemberRowDTO } from "@/actions/schemas/project-membership"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "next-intl"
import { TaskAssigneeSelect } from "./task-assignee-select"
import { TaskPrioritySelect } from "./task-priority-select"

export function TaskFormDetailsStep({
  name,
  description,
  priority,
  assigneeId,
  startDate,
  startTime,
  endDate,
  endTime,
  members,
  errors,
  onNameChange,
  onDescriptionChange,
  onPriorityChange,
  onAssigneeChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onNext,
  onCancel,
}: {
  name: string
  description: string
  priority: TaskPriorityDTO
  assigneeId: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  members: ProjectMemberRowDTO[]
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriorityChange: (value: TaskPriorityDTO) => void
  onAssigneeChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onNext: () => void
  onCancel: () => void
}) {
  const t = useTranslations()

  return (
    <FieldGroup>
      <Field data-invalid={!!errors.name || undefined}>
        <FieldLabel htmlFor="name">{t("projects.tasks.name")}</FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="priority">{t("common.priority")}</FieldLabel>
        <TaskPrioritySelect
          id="priority"
          priority={priority}
          onPriorityChange={onPriorityChange}
          fullWidth
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="assignee">{t("common.assignee")}</FieldLabel>
        <TaskAssigneeSelect
          value={assigneeId}
          onChange={onAssigneeChange}
          members={members}
        />
      </Field>
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
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
          />
        </div>
        {errors.startDate && <FieldError>{errors.startDate}</FieldError>}
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
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
          />
        </div>
        {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
      </Field>
      <Field orientation="horizontal">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={onNext}>
          {t("common.continue")}
        </Button>
      </Field>
    </FieldGroup>
  )
}
