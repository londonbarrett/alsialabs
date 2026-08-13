"use server"

import { auth, isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectOwnersTable,
  routinesTable,
} from "@/lib/drizzle/schema"
import { getMyTasks } from "@/lib/actions/tasks"
import type { CalendarEvent } from "@/lib/calendar"
import { occurrencesInRange } from "@/lib/calendar/util/schedule"
import {
  endOfDay,
  startOfDay,
  type ScheduleConfig,
} from "@/lib/util/schedule"
import { and, eq, exists, or, sql } from "drizzle-orm"

const TASK_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
]

const ROUTINE_COLOR = "#0d9488"

const RANGE_DAYS = 90

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const session = await auth()
  if (!session?.user) return []

  const from = startOfDay(new Date())
  from.setDate(from.getDate() - RANGE_DAYS)
  const to = endOfDay(new Date())
  to.setDate(to.getDate() + RANGE_DAYS)

  const events: CalendarEvent[] = []

  const tasks = await getMyTasks()
  for (const task of tasks) {
    if (!task.dueDate) continue
    const due = task.dueDate
    if (due.getTime() < from.getTime() || due.getTime() > to.getTime()) {
      continue
    }
    const isAllDay = due.getHours() === 0 && due.getMinutes() === 0
    const end = isAllDay
      ? new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
      : new Date(due.getTime() + 60 * 60 * 1000)

    events.push({
      id: `task-${task.id}`,
      title: task.name,
      description: task.projectName,
      start: due,
      end,
      allDay: isAllDay,
      color: taskColor(task.projectId),
    })
  }

  const routines = await getVisibleRoutines(session.user.id)
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
        : new Date(occurrence.getTime() + 60 * 60 * 1000)
      events.push({
        id: `routine-${routine.id}-${occurrence.getTime()}`,
        title: routine.name,
        start: occurrence,
        end,
        allDay: isAllDay,
        color: ROUTINE_COLOR,
      })
    }
  }

  return events
}

function taskColor(projectId: string): string {
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0
  }
  return TASK_COLORS[hash % TASK_COLORS.length]
}

async function getVisibleRoutines(userId: string) {
  const session = await auth()
  if (!session?.user) return []
  const isSuper = isSuperUser(session)

  const conditions = []
  if (!isSuper) {
    conditions.push(
      or(
        eq(routinesTable.assigneeId, userId),
        exists(
          db
            .select({ one: sql`1` })
            .from(projectOwnersTable)
            .where(
              and(
                eq(projectOwnersTable.projectId, routinesTable.projectId),
                eq(projectOwnersTable.userId, userId)
              )
            )
        )
      )
    )
  }

  return db
    .select({
      id: routinesTable.id,
      name: routinesTable.name,
      recurrence: routinesTable.recurrence,
      interval: routinesTable.interval,
      daysOfWeek: routinesTable.daysOfWeek,
      time: routinesTable.time,
      startDate: routinesTable.startDate,
      endDate: routinesTable.endDate,
    })
    .from(routinesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
}
