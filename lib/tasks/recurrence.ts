import type { Task } from "@/lib/drizzle/schema"
import {
  computeScheduledFor,
  startOfDay,
  type ScheduleConfig,
} from "@/lib/util/schedule"

type RecurringTask = Pick<
  Task,
  "recurrence" | "interval" | "daysOfWeek" | "startTime"
> & {
  /** Optional "until": when set, no occurrence is produced past this day. */
  endDate?: Date | null
}

/**
 * The next occurrence for a repeating task, anchored after `after`. Returns
 * null when the task does not repeat, has no start time, the schedule can't
 * produce a date, or the slot would fall after the task's end date — which is
 * inclusive through its whole day. No end date means the task repeats until
 * its recurrence is turned off or it is deleted.
 */
export function computeNextOccurrence(
  task: RecurringTask,
  after: Date
): Date | null {
  if (!task.recurrence || !task.startTime) return null

  const schedule: ScheduleConfig = {
    recurrence: task.recurrence,
    interval: task.interval,
    daysOfWeek: task.daysOfWeek ?? [],
    time: task.startTime,
  }

  const next = computeScheduledFor(after, schedule)
  if (!next) return null

  if (task.endDate) {
    const lastDay = startOfDay(task.endDate)
    lastDay.setHours(23, 59, 59, 999)
    if (next.getTime() > lastDay.getTime()) return null
  }

  return next
}
