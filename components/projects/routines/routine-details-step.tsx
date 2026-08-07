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
import { routineTemplates } from "@/lib/routines/templates"
import { useTranslations } from "next-intl"
import { useState } from "react"

export interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface RoutineDetailsStepProps {
  projectMembers: ProjectMember[]
  showTemplate: boolean
  name: string
  description: string
  cost: string
  assigneeId: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCostChange: (value: string) => void
  onAssigneeChange: (value: string) => void
  onApplyTemplate: (templateId: string) => void
  onNext: () => void
  onCancel: () => void
}

export function RoutineDetailsStep({
  projectMembers,
  showTemplate,
  name,
  description,
  cost,
  assigneeId,
  onNameChange,
  onDescriptionChange,
  onCostChange,
  onAssigneeChange,
  onApplyTemplate,
  onNext,
  onCancel,
}: RoutineDetailsStepProps) {
  const t = useTranslations()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleNameChange(value: string) {
    onNameChange(value)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.name
      return next
    })
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const fieldErrors: Record<string, string> = {}
    if (!name.trim())
      fieldErrors.name = t("projects.routines.nameRequired")
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length === 0) onNext()
  }

  return (
    <form onSubmit={handleNext}>
      <FieldGroup>
        {showTemplate && (
          <Field>
            <FieldLabel htmlFor="template">
              {t("projects.routines.template")}
            </FieldLabel>
            <Select onValueChange={onApplyTemplate}>
              <SelectTrigger id="template" className="w-full">
                <SelectValue
                  placeholder={t("projects.routines.noTemplate")}
                />
              </SelectTrigger>
              <SelectContent>
                {routineTemplates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {t(tpl.nameKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field data-invalid={!!errors.name || undefined}>
          <FieldLabel htmlFor="name">
            {t("projects.routines.name")}
          </FieldLabel>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            aria-invalid={!!errors.name || undefined}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="description">
            {t("projects.routines.description")}
          </FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost">
            {t("projects.routines.cost")}
          </FieldLabel>
          <MoneyInput id="cost" value={cost} onChange={onCostChange} />
        </Field>
        <Field>
          <FieldLabel htmlFor="assignee">
            {t("projects.routines.assignee")}
          </FieldLabel>
          <Select value={assigneeId} onValueChange={onAssigneeChange}>
            <SelectTrigger id="assignee" className="w-full">
              <SelectValue
                placeholder={t("projects.routines.unassigned")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                {t("projects.routines.unassigned")}
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
          <Button type="submit">{t("common.continue")}</Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
