import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import type { TaskStatus } from "@/lib/drizzle/schema"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { endOfDay } from "@/lib/util/schedule"

export function isOpenAssignment(a: { status: string }): boolean {
  return !isTerminalStatus(a.status as TaskStatus)
}

/**
 * Visibility for the project task list: live (open) work always shows,
 * a done assignment hides the task outright, and everything else stays
 * visible through the whole calendar day of its due date.
 */
export function shouldShowTask(
  task: { assignments: TaskAssignmentDTO[]; endDate: Date | null },
  now: Date
): boolean {
  const { assignments, endDate } = task

  if (assignments.some(isOpenAssignment)) return true
  if (assignments.some((a) => a.status === "done")) return false
  if (!endDate) return true
  return now.getTime() <= endOfDay(endDate).getTime()
}

export function assignmentCounts(assignments: TaskAssignmentDTO[]): {
  open: number
  blocked: number
  review: number
} {
  let open = 0
  let blocked = 0
  let review = 0

  for (const a of assignments) {
    if (!isTerminalStatus(a.status)) open++
    if (a.status === "blocked") blocked++
    if (a.status === "in_review") review++
  }

  return { open, blocked, review }
}
