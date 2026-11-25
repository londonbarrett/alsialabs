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
import type { Project } from "@/lib/drizzle/schema"
import {
  COUNTRY_TIMEZONES,
  countryOptionLabel,
  defaultTimeZoneForCountry,
  projectMoneyProps,
  sortedProjectCountries,
  type ProjectCountry,
} from "@/lib/projects/location"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { type ProjectColor } from "./colors"
import { ProjectColorField } from "./project-color-field"

export type ProjectFormValues = {
  name: string
  categoryId: string
  status: "active" | "completed" | "cancelled" | "archived"
  description: string
  startDate: string
  endDate: string
  location: string
  country: ProjectCountry
  timeZone: string
  budget: string
  color: ProjectColor
}

export type ProjectFormSubmit = (values: ProjectFormValues) => void

type ProjectFormProps = {
  categories: { id: string; slug: string; name: string }[]
  project?: Project
  onSubmit: ProjectFormSubmit
  onCancel: () => void
}

export function ProjectForm({
  project,
  categories,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const t = useTranslations()
  const locale = useLocale()
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
  const [country, setCountry] = useState<ProjectCountry | "">(
    project?.country ?? ""
  )
  const [timeZone, setTimeZone] = useState(project?.timeZone ?? "")
  // A stored zone is already a choice: changing the country must not replace it.
  const [zoneChosen, setZoneChosen] = useState(Boolean(project?.timeZone))
  const [budget, setBudget] = useState(project?.budget ?? "")
  const [color, setColor] = useState<string | undefined>(project?.color)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const countryOptions = useMemo(
    () =>
      sortedProjectCountries(locale).map((code) => ({
        value: code,
        label: countryOptionLabel(code, locale),
      })),
    [locale]
  )

  const zoneOptions = useMemo(() => {
    const zones = country ? [...(COUNTRY_TIMEZONES[country] ?? [])] : []
    if (!zones.includes("UTC")) zones.push("UTC")
    // Keep an explicit choice selectable after the country changes.
    if (timeZone && !zones.includes(timeZone)) zones.push(timeZone)
    return zones.map((value) => ({ value, label: value }))
  }, [country, timeZone])

  const handleCountryChange = useCallback(
    (value: string | null) => {
      if (!value) return
      const nextCountry = value as ProjectCountry
      setCountry(nextCountry)
      if (!zoneChosen) setTimeZone(defaultTimeZoneForCountry(nextCountry))
    },
    [zoneChosen]
  )

  const handleTimeZoneChange = useCallback((value: string | null) => {
    if (!value) return
    setTimeZone(value)
    setZoneChosen(true)
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("common.nameRequired")
    if (!categoryId)
      fieldErrors.categoryId = t("common.categoryRequired")
    if (!startDate)
      fieldErrors.startDate = t("projects.startDateRequired")
    if (!location.trim())
      fieldErrors.location = t("projects.locationRequired")
    if (!country) fieldErrors.country = t("projects.countryRequired")
    if (!timeZone) fieldErrors.timeZone = t("projects.timeZoneRequired")
    if (!color) fieldErrors.color = t("projects.colorRequired")
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    if (!validate()) return
    if (!country) return

    const data: ProjectFormValues = {
      name: name.trim(),
      categoryId,
      status: status as ProjectFormValues["status"],
      description: description.trim(),
      startDate,
      endDate: endDate.trim(),
      location: location.trim(),
      country,
      timeZone,
      budget: budget.trim(),
      color: color as ProjectColor,
    }

    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t("common.name")}
        value={name}
        onChange={setName}
        error={errors.name}
      />

      <div
        className="flex flex-col gap-2"
        data-invalid={!!errors.categoryId || undefined}
      >
        <Label htmlFor="categoryId">{t("common.category")}</Label>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            if (value) setCategoryId(value as string)
          }}
          items={categories.map((c) => ({
            value: c.id,
            label: t.has(`categoryNames.${c.slug}`)
              ? t(`categoryNames.${c.slug}`)
              : c.name,
          }))}
        >
          <SelectTrigger
            id="categoryId"
            aria-invalid={!!errors.categoryId}
          >
            <SelectValue placeholder={t("common.selectCategory")} />
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
          <Label htmlFor="status">{t("common.status")}</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (value) setStatus(value as string)
            }}
            items={[
              { value: "active", label: t("projects.status.active") },
              {
                value: "completed",
                label: t("projects.status.completed"),
              },
              {
                value: "cancelled",
                label: t("projects.status.cancelled"),
              },
              {
                value: "archived",
                label: t("projects.status.archived"),
              },
            ]}
          >
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
        label={t("common.description")}
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
        <div
          className="flex flex-col gap-2"
          data-invalid={!!errors.country || undefined}
        >
          <Label htmlFor="country">{t("common.countryCurrency")}</Label>
          <Select
            value={country}
            onValueChange={handleCountryChange}
            items={countryOptions}
          >
            <SelectTrigger
              id="country"
              className="w-full"
              aria-invalid={!!errors.country}
            >
              <SelectValue placeholder={t("common.countryCurrency")} />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-(--anchor-width)">
              {countryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.country && (
            <p
              id="country-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {errors.country}
            </p>
          )}
        </div>

        <div
          className="flex flex-col gap-2"
          data-invalid={!!errors.timeZone || undefined}
        >
          <Label htmlFor="timeZone">{t("common.timeZone")}</Label>
          <Select
            value={timeZone}
            onValueChange={handleTimeZoneChange}
            items={zoneOptions}
          >
            <SelectTrigger
              id="timeZone"
              className="w-full"
              aria-invalid={!!errors.timeZone}
            >
              <SelectValue placeholder={t("common.timeZone")} />
            </SelectTrigger>
            <SelectContent>
              {zoneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.timeZone && (
            <p
              id="timeZone-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {errors.timeZone}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="location"
          label={t("common.location")}
          value={location}
          onChange={setLocation}
          error={errors.location}
        />
        <Field
          name="budget"
          label={t("common.budget")}
          value={budget}
          onChange={setBudget}
          error={errors.budget}
          type="money"
          {...(country ? projectMoneyProps(country) : {})}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {project
            ? t("common.saveChanges")
            : t("projects.createProject")}
        </Button>
      </div>
    </form>
  )
}
