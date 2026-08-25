import type {
  CalendarEvent,
} from "../types"
import type {
  CalendarRoutineData,
  CalendarTaskData,
} from "@/lib/types"
import { startOfDay, type ScheduleConfig } from "@/lib/util/schedule"
import { occurrencesInRange } from "./schedule"

const HOUR_MS = 60 * 60 * 1000

function buildTaskEvents(
  tasks: CalendarTaskData[],
  from: Date,
  to: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const task of tasks) {
    if (!task.dueDate) continue
    const due = task.dueDate
    if (due.getTime() < from.getTime() || due.getTime() > to.getTime()) {
      continue
    }
    const isAllDay = due.getHours() === 0 && due.getMinutes() === 0
    const end = isAllDay
      ? new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
      : new Date(due.getTime() + HOUR_MS)

    events.push({
      id: `task-${task.id}`,
      title: task.name,
      description: task.projectName,
      start: due,
      end,
      allDay: isAllDay,
      color: task.projectColor,
      meta: {
        kind: "task",
        taskId: task.id,
        projectId: task.projectId,
        projectName: task.projectName,
        projectOwnerName: task.projectOwnerName ?? null,
        status: task.status,
        priority: task.priority,
        assigneeName: task.assigneeName,
        dueDateIso: task.dueDate?.toISOString() ?? null,
        description: task.description,
        cost: task.cost,
        commentCount: task.commentCount,
        routineId: task.routineId ?? undefined,
      },
    })
  }
  return events
}

function buildRoutineEvents(
  routines: CalendarRoutineData[],
  from: Date,
  to: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const routine of routines) {
    const schedule: ScheduleConfig = {
      recurrence: routine.recurrence,
      interval: routine.interval,
      daysOfWeek: routine.daysOfWeek ?? [],
      time: routine.time,
      startDate: routine.startDate ?? undefined,
      endDate: routine.endDate ?? undefined,
    }
    for (const occurrence of occurrencesInRange(schedule, from, to)) {
      const isAllDay = !routine.time
      const end = isAllDay
        ? new Date(
            occurrence.getFullYear(),
            occurrence.getMonth(),
            occurrence.getDate() + 1
          )
        : new Date(occurrence.getTime() + HOUR_MS)
      events.push({
        id: `routine-${routine.id}-${occurrence.getTime()}`,
        title: routine.name,
        start: occurrence,
        end,
        allDay: isAllDay,
        color: routine.projectColor,
        meta: {
          kind: "routine",
          routineId: routine.id,
          projectId: routine.projectId,
          projectName: routine.projectName,
          projectOwnerName: routine.projectOwnerName ?? null,
          assigneeName: routine.assigneeName ?? null,
          description: routine.description,
          cost: routine.cost ? routine.cost.toString() : null,
          recurrence: routine.recurrence,
          interval: routine.interval,
          daysOfWeek: routine.daysOfWeek ?? [],
          time: routine.time,
          startDate: routine.startDate ?? null,
          endDate: routine.endDate ?? null,
        },
      })
    }
  }
  return events
}

/**
 * Builds the events for a visible range entirely on the client.
 * Routine chips are hidden on days where a task spawned by the same
 * routine already has a due date.
 */
export function buildCalendarEvents(
  tasks: CalendarTaskData[],
  routines: CalendarRoutineData[],
  from: Date,
  to: Date
): CalendarEvent[] {
  const events = [
    ...buildTaskEvents(tasks, from, to),
    ...buildRoutineEvents(routines, from, to),
  ]

  const taskRoutineDays = new Map<string, Set<number>>()
  for (const task of tasks) {
    if (!task.routineId || !task.dueDate) continue
    let days = taskRoutineDays.get(task.routineId)
    if (!days) {
      days = new Set<number>()
      taskRoutineDays.set(task.routineId, days)
    }
    days.add(startOfDay(task.dueDate).getTime())
  }

  return events.filter((event) => {
    if (event.meta?.kind !== "routine") return true
    const routineId = event.meta.routineId
    if (!routineId) return true
    const routineDay = startOfDay(event.start).getTime()
    return !taskRoutineDays.get(routineId)?.has(routineDay)
  })
}
