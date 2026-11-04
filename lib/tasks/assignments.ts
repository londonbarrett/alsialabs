import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import type { TaskAssignmentDTO } from "@/actions/schemas/task"
import { isTerminalStatus } from "@/lib/util/project-roles"
import {
  computeScheduledFor,
  startOfDay,
  type ScheduleConfig,
} from "@/lib/util/schedule"

/**
 * Open occurrences first, earliest start first. Consumers that read
 * `assignments[0]` (the project task list, the edit form's assignee) must
 * bind to live work: after a repeat spawns, the closed row can otherwise sit
 * at index 0 and hide the open occurrence behind a read-only badge.
 */
export function sortAssignments<
  T extends { status: string; startDate: Date | string | null },
>(rows: T[]): T[] {
  // The detail view hands its date columns back as raw driver strings (the
  // schemas coerce them later), so sorting must understand both shapes.
  const start = (value: Date | string | null): number => {
    if (!value) return Number.MAX_SAFE_INTEGER
    const time =
      value instanceof Date ? value.getTime() : Date.parse(value)
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
  }

  return [...rows].sort((a, b) => {
    const aRank = isTerminalStatus(a.status as TaskStatus) ? 1 : 0
    const bRank = isTerminalStatus(b.status as TaskStatus) ? 1 : 0
    if (aRank !== bRank) return aRank - bRank

    return start(a.startDate) - start(b.startDate)
  })
}

export function atTime(date: Date, time: string | null): Date {
  if (!time) return new Date(date)
  const [hours, minutes] = time.split(":").map(Number)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours || 0,
    minutes || 0
  )
}

export type AssignmentWindow = {
  startDate: Date | null
  endDate: Date | null
}

type SchedulableTask = Pick<
  Task,
  | "startDate"
  | "endDate"
  | "recurrence"
  | "interval"
  | "daysOfWeek"
  | "startTime"
  | "endTime"
>

/** The window copied onto the assignments created with a task. */
export function firstAssignmentWindow(
  task: SchedulableTask
): AssignmentWindow {
  if (!task.recurrence) {
    return { startDate: task.startDate, endDate: task.endDate }
  }

  const schedule: ScheduleConfig = {
    recurrence: task.recurrence,
    interval: task.interval,
    daysOfWeek: task.daysOfWeek ?? [],
    time: task.startTime ?? null,
  }
  // A future start date anchors the schedule (the form defaults it to today);
  // anything else anchors at "now" so the first occurrence is never in the past.
  const anchor = task.startDate ? startOfDay(task.startDate) : null
  const occurrence = computeScheduledFor(
    anchor && anchor.getTime() > Date.now() ? anchor : new Date(),
    schedule
  )
  if (!occurrence) return { startDate: null, endDate: null }

  return {
    startDate: occurrence,
    endDate: atTime(occurrence, task.endTime),
  }
}

type AssignmentRow = {
  assignmentId: string
  taskId: string
  userId: string
  status: string
  comment: string | null
  startDate: Date | null
  endDate: Date | null
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

export function toTaskAssignmentDTO(
  row: AssignmentRow
): TaskAssignmentDTO {
  return {
    id: row.assignmentId,
    taskId: row.taskId,
    userId: row.userId,
    status: row.status as TaskStatus,
    comment: row.comment,
    startDate: row.startDate,
    endDate: row.endDate,
    userName: row.userName,
    userEmail: row.userEmail,
    userImage: row.userImage,
  }
}
