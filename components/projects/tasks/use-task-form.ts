"use client"

import type {
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import {
  validateRepeatingWindow,
  validateTaskDetails,
  validateTaskName,
} from "@/lib/tasks/form-validation"
import type {
  TaskDetailsIssue,
  TaskDetailsValues,
} from "@/lib/tasks/form-validation"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import {
  type FieldErrors,
  type Resolver,
  useForm,
  useWatch,
} from "react-hook-form"

/** The payload the task form hands to its caller, unchanged by the refactor. */
export interface TaskFormSubmitValues {
  name: string
  cost: string
  description: string
  priority: string | null
  assigneeIds: string[]
  unassignAs: Record<string, "done" | "cancelled">
  startDate: string | null
  endDate: string | null
  recurrence: "daily" | "weekly" | null
  interval: number
  daysOfWeek: string[]
  startTime: string
  endTime: string
}

/** Everything the wizard edits. All fields are strings where inputs are. */
interface TaskFormValues {
  name: string
  cost: string
  description: string
  priority: TaskPriorityDTO
  assigneeIds: string[]
  unassignAs: Record<string, "done" | "cancelled">
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  repeat: boolean
  recurrence: "daily" | "weekly"
  interval: string
  daysOfWeek: string[]
  occurrenceStart: string
  occurrenceEnd: string
}

interface UseTaskFormParams {
  task?: TaskWithAssignmentsDTO
  onSubmit: (values: TaskFormSubmitValues) => void
  onCancel: () => void
}

/**
 * Stored instants are formatted in the project's zone, never the browser's:
 * the form edits wall-clock values, so host-local getters would shift them.
 */
function wallClockParts(
  instant: Date,
  timeZone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  }
}

/**
 * The All-day switch and the repeat switch each decide which time/date fields
 * are authoritative. Both validation and submission derive from this one place
 * so they can never disagree about what will travel to the server.
 */
function deriveSchedule(values: TaskFormValues, timeZone: string) {
  return {
    effectiveStartDate:
      values.repeat && !values.startDate
        ? wallClockParts(new Date(), timeZone).date
        : values.startDate,
    winStart: values.allDay ? "" : values.startTime,
    winEnd: values.allDay ? "" : values.endTime,
    occStart: values.allDay ? "" : values.occurrenceStart,
    occEnd: values.allDay ? "" : values.occurrenceEnd,
  }
}

function buildDefaultValues(
  task: TaskWithAssignmentsDTO | undefined,
  members: { userId: string }[],
  timeZone: string
): TaskFormValues {
  // The roster (not open rows) is the source: a zero-open task still shows its
  // assignees, and a roster user who left the project is dropped so they can
  // never travel in the payload as an unrenderable chip.
  const protectedIds = task
    ? task.assigneeIds.filter((userId) =>
        members.some((m) => m.userId === userId)
      )
    : []
  const allDay = task ? !task.startTime : true

  return {
    name: task?.name ?? "",
    cost: task?.cost ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? null,
    assigneeIds: protectedIds,
    unassignAs: {},
    allDay,
    startDate: task?.startDate
      ? wallClockParts(task.startDate, timeZone).date
      : task?.recurrence
        ? wallClockParts(new Date(), timeZone).date
        : "",
    startTime: allDay ? "" : (task?.startTime ?? ""),
    endDate: task?.endDate
      ? wallClockParts(task.endDate, timeZone).date
      : "",
    endTime: allDay ? "" : (task?.endTime ?? ""),
    repeat: Boolean(task?.recurrence),
    recurrence: task?.recurrence === "daily" ? "daily" : "weekly",
    interval: String(task?.interval ?? 1),
    daysOfWeek: task?.daysOfWeek ?? [],
    occurrenceStart: task?.startTime ?? "",
    occurrenceEnd: task?.endTime ?? "",
  }
}

/**
 * Owns every piece of task-form state: field values, wizard step, validation,
 * and all event handlers. Consumers only wire the returned values and handlers
 * into the step components; no form logic lives in a component.
 */
export function useTaskForm({ task, onSubmit, onCancel }: UseTaskFormParams) {
  const t = useTranslations()
  const { members, project } = useProjectContextState()
  const timeZone = project.timeZone
  const [step, setStep] = useState(1)
  const [step1Done, setStep1Done] = useState(false)

  const protectedIds = useMemo(
    () =>
      task
        ? task.assigneeIds.filter((userId) =>
            members.some((m) => m.userId === userId)
          )
        : [],
    [task, members]
  )
  const defaultValues = useMemo(
    () => buildDefaultValues(task, members, timeZone),
    // Defaults are read once by useForm; the task prop identifies the edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, timeZone]
  )

  const resolver = useCallback<Resolver<TaskFormValues>>(
    (values) => {
      const { effectiveStartDate, winStart, winEnd, occStart, occEnd } =
        deriveSchedule(values, timeZone)
      const nonRepeatingValues: TaskDetailsValues = {
        name: values.name,
        startDate: values.endDate,
        startTime: winStart,
        endDate: values.endDate,
        endTime: winEnd,
      }
      const issues: TaskDetailsIssue[] = values.repeat
        ? [
            ...validateTaskName(values.name),
            ...validateRepeatingWindow({
              startDate: effectiveStartDate,
              endDate: values.endDate,
            }),
          ]
        : validateTaskDetails(nonRepeatingValues, { requireWindow: true })

      const errors: FieldErrors<TaskFormValues> = {}
      for (const issue of issues) {
        switch (issue) {
          case "NAME_REQUIRED":
            errors.name = {
              type: "required",
              message: t("projects.tasks.nameRequired"),
            }
            break
          case "START_DATE_REQUIRED":
            errors.startDate = {
              type: "required",
              message: t("common.dateRequired"),
            }
            break
          case "END_DATE_REQUIRED":
            errors.endDate = {
              type: "required",
              message: t("common.dateRequired"),
            }
            break
          case "START_TIME_REQUIRED":
            errors.startTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
            break
          case "END_TIME_REQUIRED":
            errors.endTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
            break
          case "END_BEFORE_START":
          case "SAME_DAY_REQUIRED":
            errors.endDate = {
              type: "validate",
              message: t("projects.routines.endBeforeStart"),
            }
            break
        }
      }

      // Off All-day the times are the point of the mode: both are required in
      // either branch. All-day submits empty times and demands none.
      if (!values.allDay) {
        if (values.repeat) {
          if (!occStart)
            errors.startTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
          if (!occEnd)
            errors.endTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
        } else {
          if (!winStart)
            errors.startTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
          if (!winEnd)
            errors.endTime = {
              type: "required",
              message: t("common.timeRequired"),
            }
        }
      }
      if (
        values.repeat &&
        values.recurrence === "weekly" &&
        values.daysOfWeek.length === 0
      ) {
        errors.daysOfWeek = {
          type: "required",
          message: t("projects.routines.atLeastOneDay"),
        }
      }

      return Object.keys(errors).length > 0
        ? { values: {}, errors }
        : { values, errors: {} }
    },
    [t, timeZone]
  )

  const {
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    handleSubmit: submit,
    formState: { errors: formErrors },
  } = useForm<TaskFormValues>({
    defaultValues,
    resolver,
    mode: "onSubmit",
  })

  const values = useWatch({ control }) as TaskFormValues
  const errors = useMemo(() => {
    const messages: Record<string, string> = {}
    for (const [field, error] of Object.entries(formErrors)) {
      if (error && typeof error.message === "string") {
        messages[field] = error.message
      }
    }
    return messages
  }, [formErrors])

  const onValid = useCallback(
    (submitted: TaskFormValues) => {
      const { effectiveStartDate, winStart, winEnd, occStart, occEnd } =
        deriveSchedule(submitted, timeZone)
      // Wall-clock days and times travel separately: the server resolves them
      // to instants in the project zone. No toISOString() — that would freeze
      // the browser's zone into a value the project does not own.
      onSubmit({
        name: submitted.name.trim(),
        cost: submitted.cost,
        description: submitted.description.trim(),
        priority: submitted.priority,
        assigneeIds: submitted.assigneeIds,
        unassignAs: submitted.unassignAs,
        startDate: submitted.repeat
          ? effectiveStartDate
          : submitted.endDate || null,
        endDate: submitted.endDate || null,
        recurrence: submitted.repeat ? submitted.recurrence : null,
        interval: Number(submitted.interval) || 1,
        daysOfWeek: submitted.repeat ? submitted.daysOfWeek : [],
        startTime: submitted.repeat ? occStart : winStart,
        endTime: submitted.repeat ? occEnd : winEnd,
      })
    },
    [onSubmit, timeZone]
  )

  // A name lives on step one — bounce back so its message is visible; window
  // errors already render in place on the schedule step.
  const onInvalid = useCallback((invalidErrors: FieldErrors<TaskFormValues>) => {
    if (invalidErrors.name) setStep(1)
  }, [])

  const handleSubmit = submit(onValid, onInvalid)

  const goNext = useCallback(() => {
    if (validateTaskName(getValues("name")).length > 0) {
      setError("name", {
        type: "required",
        message: t("projects.tasks.nameRequired"),
      })
      return
    }
    clearErrors()
    setStep1Done(true)
    setStep(2)
  }, [getValues, setError, clearErrors, t])

  const goBack = useCallback(() => setStep(1), [])

  const handleStepSelect = useCallback(
    (target: number) => {
      if (target === 2) {
        goNext()
        return
      }
      setStep(target)
    },
    [goNext]
  )

  const handleRepeatChange = useCallback(
    (value: boolean) => {
      setValue("repeat", value, { shouldDirty: true })
      clearErrors()
      if (value && !getValues("startDate")) {
        setValue("startDate", wallClockParts(new Date(), timeZone).date, {
          shouldDirty: true,
        })
      }
    },
    [setValue, clearErrors, getValues, timeZone]
  )

  const handleAllDayChange = useCallback(
    (value: boolean) => {
      setValue("allDay", value, { shouldDirty: true })
      clearErrors()
    },
    [setValue, clearErrors]
  )

  const toggleDay = useCallback(
    (day: string) => {
      const days = getValues("daysOfWeek")
      setValue(
        "daysOfWeek",
        days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
        { shouldDirty: true }
      )
    },
    [getValues, setValue]
  )

  const recordDisposition = useCallback(
    (userId: string, disposition: "done" | "cancelled") => {
      setValue(
        "unassignAs",
        { ...getValues("unassignAs"), [userId]: disposition },
        { shouldDirty: true }
      )
    },
    [getValues, setValue]
  )

  const onNameChange = (value: string) => setValue("name", value)
  const onCostChange = (value: string) => setValue("cost", value)
  const onDescriptionChange = (value: string) =>
    setValue("description", value)
  const onPriorityChange = (value: TaskPriorityDTO) =>
    setValue("priority", value)
  const onAssigneeChange = (value: string[]) => setValue("assigneeIds", value)
  const onStartDateChange = (value: string) => setValue("startDate", value)
  const onStartTimeChange = (value: string) => setValue("startTime", value)
  const onEndDateChange = (value: string) => setValue("endDate", value)
  const onEndTimeChange = (value: string) => setValue("endTime", value)
  const onRecurrenceChange = (value: "daily" | "weekly") =>
    setValue("recurrence", value)
  const onIntervalChange = (value: string) => setValue("interval", value)
  const onOccurrenceStartTimeChange = (value: string) =>
    setValue("occurrenceStart", value)
  const onOccurrenceEndTimeChange = (value: string) =>
    setValue("occurrenceEnd", value)

  return {
    values,
    errors,
    step,
    step1Done,
    protectedIds,
    handleSubmit,
    goNext,
    goBack,
    handleStepSelect,
    handleRepeatChange,
    handleAllDayChange,
    toggleDay,
    recordDisposition,
    onNameChange,
    onCostChange,
    onDescriptionChange,
    onPriorityChange,
    onAssigneeChange,
    onStartDateChange,
    onStartTimeChange,
    onEndDateChange,
    onEndTimeChange,
    onRecurrenceChange,
    onIntervalChange,
    onOccurrenceStartTimeChange,
    onOccurrenceEndTimeChange,
    onCancel,
  }
}
