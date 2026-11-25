import type { CalendarEvent } from "../types"
import type { CalendarAssignmentDTO } from "@/actions/calendar/schemas"

const HOUR_MS = 60 * 60 * 1000

/**
 * The grid iterates host-local days, so hand it a Date whose local fields are
 * the project's wall clock — otherwise a late-evening event would land in the
 * next day's column. Both inputs are plain strings resolved on the server:
 * no Temporal and no zone arithmetic in the browser. The real instant stays
 * in `meta.startDateIso` / `meta.endDateIso`.
 */
function gridDate(dateKey: string, time: string | null): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hour, minute] = (time || "00:00").split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

/**
 * One event per task per day in the day's own project zone. An assignment
 * carries its own date and zone, so two assignees of the same task can
 * legitimately be on different days and are never merged across them.
 */
export function buildCalendarEvents(
  assignments: CalendarAssignmentDTO[],
  from: Date,
  to: Date
): CalendarEvent[] {
  const groups = new Map<string, CalendarAssignmentDTO[]>()

  for (const assignment of assignments) {
    if (!assignment.startDate) continue
    if (
      assignment.startDate.getTime() < from.getTime() ||
      assignment.startDate.getTime() > to.getTime()
    ) {
      continue
    }
    const key = `${assignment.taskId}|${assignment.dateKey}`
    const list = groups.get(key) ?? []
    list.push(assignment)
    groups.set(key, list)
  }

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]
    const start = first.startDate!
    const isAllDay = first.startTime === null
    const displayStart = gridDate(first.dateKey, first.startTime)

    // An all-day event spans its whole day with an exclusive midnight end:
    // the week/day lane's strict `end > dayStart` filter would otherwise
    // drop a zero-duration midnight-to-midnight event, and month-view
    // "past" styling would dim it from its first minute.
    const exclusiveEnd =
      isAllDay &&
      (!first.endDate || first.endDate.getTime() <= start.getTime())
        ? new Date(
            displayStart.getFullYear(),
            displayStart.getMonth(),
            displayStart.getDate() + 1
          )
        : null
    const end = first.endDate ?? new Date(start.getTime() + HOUR_MS)
    // Carry the window's duration over to the grid date; only the anchor is
    // a wall-clock value, never the instants themselves.
    const displayEnd =
      exclusiveEnd ??
      new Date(displayStart.getTime() + (end.getTime() - start.getTime()))

    return {
      id: `assignment-group-${key}`,
      title: first.taskName,
      description: first.projectName,
      start: displayStart,
      end: displayEnd,
      allDay: isAllDay,
      color: first.projectColor,
      meta: {
        kind: "task",
        taskId: first.taskId,
        projectId: first.projectId,
        projectName: first.projectName,
        projectOwnerName: first.projectOwnerName,
        priority: first.priority,
        status: first.status,
        assigneeName: first.userName,
        commentCount: first.commentCount,
        recurrence: first.recurrence,
        timeZone: first.timeZone,
        startTime: first.startTime,
        startDateIso: start.toISOString(),
        endDateIso: first.endDate?.toISOString() ?? null,
        assignees: group.map((assignment) => ({
          name: assignment.userName,
          image: assignment.userImage,
          status: assignment.status,
          comment: assignment.comment,
        })),
      },
    } satisfies CalendarEvent
  })
}
