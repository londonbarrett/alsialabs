import type { Task } from "@/lib/drizzle/schema"
import {
  computeScheduledFor,
  type ScheduleConfig,
} from "@/lib/util/schedule"

type RecurringTask = Pick<
  Task,
  "recurrence" | "interval" | "daysOfWeek" | "startTime"
>

/**
 * The next occurrence for a repeating task, anchored after `after`. Returns
 * null when the task does not repeat, has no start time, or the schedule can't
 * produce a date. There is no global end date: the task repeats until its
 * recurrence is turned off or it is deleted.
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

  return computeScheduledFor(after, schedule)
}
