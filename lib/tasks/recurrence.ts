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
  /** The schedule's lower bound: no occurrence is produced before this day. */
  startDate?: Date | null
  /** Optional "until": when set, no occurrence is produced past this day. */
  endDate?: Date | null
}

/**
 * Where the first occurrence of a task anchors — used by both initial row
 * creation and the "open work for someone" triggers (add assignee, date edit).
 * A future start is kept so nobody opens before the task begins; an all-day
 * start is normalized to midnight of its own day, otherwise the stored
 * timestamp's time-of-day would make the inclusive comparison skip that day.
 * Once the start is reached, an all-day task keeps today's slot while a timed
 * one moves strictly to now, so no backdated work is ever opened.
 */
export function firstOccurrenceAnchor(
  task: Pick<Task, "startDate" | "startTime">,
  now: Date = new Date()
): { anchor: Date; inclusive: boolean } {
  const start = task.startDate
  if (!task.startTime) {
    // An all-day slot is a whole calendar day: compare at day precision and
    // keep the anchor itself (strict "after" would push it to tomorrow).
    const today = startOfDay(now)
    const firstDay = start ? startOfDay(start) : null
    return {
      anchor:
        firstDay && firstDay.getTime() > today.getTime() ? firstDay : today,
      inclusive: true,
    }
  }
  if (start && start.getTime() > now.getTime()) {
    return { anchor: start, inclusive: true }
  }
  return { anchor: now, inclusive: false }
}

/**
 * The next occurrence for a repeating task, anchored after `after` (or, with
 * `options.inclusive`, at-or-after it). This is the one place both bounds of a
 * schedule are enforced, so every surface gets the same date:
 *
 * - `startDate` is a lower bound at day precision. Triggers that anchor before
 *   it (unarchive anchors on now) re-anchor on the start day and keep its slot.
 * - `endDate` is inclusive through its whole day.
 *
 * Returns null when the task does not repeat, the schedule yields no slot, or
 * the slot falls outside those bounds. An all-day task (no `startTime`)
 * schedules its occurrences at midnight.
 */
export function computeNextOccurrence(
  task: RecurringTask,
  after: Date,
  options?: { inclusive?: boolean }
): Date | null {
  if (!task.recurrence) return null

  const schedule: ScheduleConfig = {
    recurrence: task.recurrence,
    interval: task.interval,
    daysOfWeek: task.daysOfWeek ?? [],
    time: task.startTime ?? "00:00",
  }

  let next = computeScheduledFor(after, schedule, options)
  if (!next) return null

  if (task.startDate) {
    const firstDay = startOfDay(task.startDate)
    if (next.getTime() < firstDay.getTime()) {
      const anchored = computeScheduledFor(firstDay, schedule, {
        inclusive: true,
      })
      if (!anchored) return null
      next = anchored
    }
  }

  if (task.endDate) {
    const lastDay = startOfDay(task.endDate)
    lastDay.setHours(23, 59, 59, 999)
    if (next.getTime() > lastDay.getTime()) return null
  }

  return next
}
