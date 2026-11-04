"use client"

import type { TaskPriorityDTO } from "@/actions/tasks/schemas"
import type { ProjectMemberRowDTO } from "@/actions/projects/schemas"
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
  members,
  errors,
  onNameChange,
  onDescriptionChange,
  onPriorityChange,
  onAssigneeChange,
  onNext,
  onCancel,
}: {
  name: string
  description: string
  priority: TaskPriorityDTO
  assigneeId: string
  members: ProjectMemberRowDTO[]
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriorityChange: (value: TaskPriorityDTO) => void
  onAssigneeChange: (value: string) => void
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
