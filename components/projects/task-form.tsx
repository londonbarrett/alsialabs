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
import type { ProjectTask } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface TaskFormProps {
  task?: ProjectTask
  projectMembers: ProjectMember[]
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    status: string
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

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cost: cost.trim(),
      status,
      assigneeId: assigneeId || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t("projects.tasks.name")}
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <Field
        name="description"
        label={t("projects.tasks.description")}
        value={description}
        onChange={setDescription}
        error={errors.description}
        type="textarea"
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="cost"
          label={t("projects.tasks.cost")}
          value={cost}
          onChange={setCost}
          error={errors.cost}
          type="money"
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">
            {t("projects.tasks.statusLabel")}
          </Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue
                placeholder={t("projects.tasks.statusLabel")}
              />
            </SelectTrigger>
            <SelectContent>
              {taskStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`projects.tasks.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="assignee">{t("projects.tasks.assignee")}</Label>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger id="assignee">
            <SelectValue placeholder={t("projects.tasks.unassigned")} />
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
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {task
            ? t("common.saveChanges")
            : t("projects.tasks.createTask")}
        </Button>
      </div>
    </form>
  )
}
