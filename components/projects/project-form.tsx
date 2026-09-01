"use client"

import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { createProject, updateProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { type ProjectColor } from "./colors"
import { ProjectColorField } from "./project-color-field"

interface ProjectFormProps {
  project?: Project
  categories: { id: string; slug: string; name: string }[]
  onSuccess: () => void
  onCancel: () => void
}

export function ProjectForm({
  project,
  categories,
  onSuccess,
  onCancel,
}: ProjectFormProps) {
  const t = useTranslations()
  const [name, setName] = useState(project?.name ?? "")
  const [categoryId, setCategoryId] = useState(
    project?.categoryId ?? ""
  )
  const [status, setStatus] = useState<string>(
    project?.status ?? "active"
  )
  const [description, setDescription] = useState(
    project?.description ?? ""
  )
  const [startDate, setStartDate] = useState(project?.startDate ?? "")
  const [endDate, setEndDate] = useState(project?.endDate ?? "")
  const [location, setLocation] = useState(project?.location ?? "")
  const [budget, setBudget] = useState(project?.budget ?? "")
  const [color, setColor] = useState<string | undefined>(project?.color)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const translateError = useActionError()
  const { executeAsync: executeCreate } = useAction(createProject)
  const { executeAsync: executeUpdate } = useAction(updateProject)

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("projects.nameRequired")
    if (!categoryId)
      fieldErrors.categoryId = t("projects.categoryRequired")
    if (!startDate)
      fieldErrors.startDate = t("projects.startDateRequired")
    if (!location.trim())
      fieldErrors.location = t("projects.locationRequired")
    if (!color) fieldErrors.color = t("projects.colorRequired")
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    const data = {
      name: name.trim(),
      categoryId,
      status: status as
        | "active"
        | "completed"
        | "cancelled"
        | "archived",
      description: description.trim(),
      startDate,
      endDate: endDate.trim(),
      location: location.trim(),
      budget: budget.trim(),
      color: color as ProjectColor,
    }

    const result = project
      ? await executeUpdate({ ...data, projectId: project.id })
      : await executeCreate(data)

    if (result?.data) {
      toast.success(
        project
          ? t("projects.projectUpdated")
          : t("projects.projectCreated")
      )
      onSuccess()
    } else {
      if (result?.validationErrors) {
        const mapped: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(
          result.validationErrors as Record<string, string[]>
        )) {
          if (msgs && msgs.length > 0) mapped[key] = msgs[0]
        }
        setErrors(mapped)
      }
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
      } else {
        toast.error(t("common.somethingWentWrong"))
      }
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t("projects.name")}
        value={name}
        onChange={setName}
        error={errors.name}
      />

      <div
        className="flex flex-col gap-2"
        data-invalid={!!errors.categoryId || undefined}
      >
        <Label htmlFor="categoryId">{t("projects.category")}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger
            id="categoryId"
            aria-invalid={!!errors.categoryId}
          >
            <SelectValue placeholder={t("projects.selectCategory")} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {t.has(`categoryNames.${c.slug}`)
                  ? t(`categoryNames.${c.slug}`)
                  : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p
            id="categoryId-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {errors.categoryId}
          </p>
        )}
      </div>

      <ProjectColorField
        value={color}
        onChange={setColor}
        error={errors.color}
      />

      {project && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("projects.statusLabel")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "active",
                  "completed",
                  "cancelled",
                  "archived",
                ] as const
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`projects.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Field
        name="description"
        label={t("projects.description")}
        value={description}
        onChange={setDescription}
        error={errors.description}
        type="textarea"
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="startDate"
          label={t("projects.startDate")}
          value={startDate}
          onChange={setStartDate}
          error={errors.startDate}
          type="date"
        />
        <Field
          name="endDate"
          label={t("projects.endDate")}
          value={endDate}
          onChange={setEndDate}
          error={errors.endDate}
          type="date"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="location"
          label={t("projects.location")}
          value={location}
          onChange={setLocation}
          error={errors.location}
        />
        <Field
          name="budget"
          label={t("projects.budget")}
          value={budget}
          onChange={setBudget}
          error={errors.budget}
          type="number"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {project
            ? t("common.saveChanges")
            : t("projects.createProject")}
        </Button>
      </div>
    </form>
  )
}
