import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import type { TaskStatus } from "@/lib/drizzle/schema"
import { isTerminalStatus } from "@/lib/util/project-roles"

export function isOpenAssignment(a: { status: string }): boolean {
  return !isTerminalStatus(a.status as TaskStatus)
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
