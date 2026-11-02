import { combineDateTime } from "@/lib/util/schedule"

export type TaskDetailsIssue =
  | "NAME_REQUIRED"
  | "START_DATE_REQUIRED"
  | "END_DATE_REQUIRED"
  | "END_BEFORE_START"
  | "SAME_DAY_REQUIRED"

export type TaskDetailsValues = {
  name: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

/** The details step owns only the name — that is what gates the wizard forward. */
export function validateTaskName(name: string): TaskDetailsIssue[] {
  return name.trim() ? [] : ["NAME_REQUIRED"]
}

/**
 * Validates the date/time window, which lives on the schedule step and is
 * checked there (and again on submit) so its messages render next to the
 * fields.
 *
 * An untouched window is only an issue when `requireWindow` says so: a
 * repeating task legitimately fills its window later — or never — while a
 * final non-repeating submit needs both dates.
 */
export function validateTaskWindow(
  values: Omit<TaskDetailsValues, "name">,
  options: { requireWindow: boolean }
): TaskDetailsIssue[] {
  const issues: TaskDetailsIssue[] = []

  const windowTouched = Boolean(values.startDate || values.endDate)
  if (!windowTouched && !options.requireWindow) return issues

  if (!values.startDate) issues.push("START_DATE_REQUIRED")
  if (!values.endDate) issues.push("END_DATE_REQUIRED")

  const start = combineDateTime(values.startDate, values.startTime)
  const end = combineDateTime(values.endDate, values.endTime)
  if (!start || !end) return issues

  if (end.getTime() < start.getTime()) {
    issues.push("END_BEFORE_START")
  } else if (start.toDateString() !== end.toDateString()) {
    issues.push("SAME_DAY_REQUIRED")
  }

  return issues
}

/**
 * The repeating schedule's dates: the start anchors the occurrences (the form
 * defaults it to today) and the end is an optional "until" — compared at day
 * precision, because its time is the occurrence time, not a deadline.
 */
export function validateRepeatingWindow(values: {
  startDate: string
  endDate: string
}): TaskDetailsIssue[] {
  const issues: TaskDetailsIssue[] = []

  if (!values.startDate) issues.push("START_DATE_REQUIRED")
  if (
    values.startDate &&
    values.endDate &&
    values.endDate.slice(0, 10) < values.startDate.slice(0, 10)
  ) {
    issues.push("END_BEFORE_START")
  }

  return issues
}

/** Name + window: everything the form must pass before it may submit. */
export function validateTaskDetails(
  values: TaskDetailsValues,
  options: { requireWindow: boolean }
): TaskDetailsIssue[] {
  return [
    ...validateTaskName(values.name),
    ...validateTaskWindow(values, options),
  ]
}
