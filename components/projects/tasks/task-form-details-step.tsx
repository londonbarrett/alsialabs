"use client"

import type { TaskPriorityDTO } from "@/actions/tasks/schemas"
import type { ProjectMemberRowDTO } from "@/actions/projects/schemas"
import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
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
  cost,
  description,
  priority,
  assigneeIds,
  members,
  protectedIds,
  errors,
  onNameChange,
  onCostChange,
  onDescriptionChange,
  onPriorityChange,
  onAssigneeChange,
  onRemoveDisposition,
  onNext,
  onCancel,
}: {
  name: string
  cost: string
  description: string
  priority: TaskPriorityDTO
  assigneeIds: string[]
  members: ProjectMemberRowDTO[]
  protectedIds: string[]
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onCostChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriorityChange: (value: TaskPriorityDTO) => void
  onAssigneeChange: (value: string[]) => void
  onRemoveDisposition: (
    userId: string,
    disposition: "done" | "cancelled"
  ) => void
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
        <FieldLabel htmlFor="cost">
          {t("projects.tasks.baseCostPerAssignment")}
        </FieldLabel>
        <MoneyInput
          id="cost"
          value={cost}
          onChange={onCostChange}
          aria-describedby="cost-help"
        />
        <FieldDescription id="cost-help">
          {t("projects.tasks.baseCostHelp")}
        </FieldDescription>
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
          value={assigneeIds}
          onChange={onAssigneeChange}
          members={members}
          protectedIds={protectedIds}
          onRemoveDisposition={onRemoveDisposition}
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
