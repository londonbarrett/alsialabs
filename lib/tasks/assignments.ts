import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import type { TaskAssignmentDTO } from "@/actions/schemas/task"
import {
  computeScheduledFor,
  type ScheduleConfig,
} from "@/lib/util/schedule"

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
  const occurrence = computeScheduledFor(new Date(), schedule)
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
