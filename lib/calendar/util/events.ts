import type { CalendarEvent } from "../types"
import type { CalendarAssignmentDTO } from "@/actions/schemas/calendar"
import { startOfDay } from "@/lib/util/schedule"

const HOUR_MS = 60 * 60 * 1000

/**
 * One event per task per day. An assignment carries its own date, so two
 * assignees of the same task can legitimately be on different days and are
 * never merged across them.
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
    const key = `${assignment.taskId}|${startOfDay(assignment.startDate).getTime()}`
    const list = groups.get(key) ?? []
    list.push(assignment)
    groups.set(key, list)
  }

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]
    const start = first.startDate!
    const end = first.endDate ?? new Date(start.getTime() + HOUR_MS)
    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0

    return {
      id: `assignment-group-${key}`,
      title: first.taskName,
      description: first.projectName,
      start,
      end,
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
