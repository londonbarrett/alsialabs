import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { isOpenAssignment, shouldShowTask } from "@/lib/tasks/filter"

export type TasksVisibilityFilter = "unfinished" | "both" | "finished"

/**
 * Rows to render for a task: while any assignment is still open the
 * finished rows are history noise, but once every row is terminal the
 * store's one-row-per-assignee invariant makes the whole set exactly
 * each assignee's last finished row, so it stays visible.
 */
export function visibleAssignments(
  assignments: TaskAssignmentDTO[]
): TaskAssignmentDTO[] {
  return assignments.some(isOpenAssignment)
    ? assignments.filter(isOpenAssignment)
    : assignments
}

const byEndDateAsc = (
  a: TaskWithAssignmentsDTO,
  b: TaskWithAssignmentsDTO
): number => {
  if (!a.endDate) return b.endDate ? 1 : 0
  if (!b.endDate) return -1
  return a.endDate.getTime() - b.endDate.getTime()
}

const byEndDateDesc = (
  a: TaskWithAssignmentsDTO,
  b: TaskWithAssignmentsDTO
): number => {
  if (!a.endDate) return b.endDate ? 1 : 0
  if (!b.endDate) return -1
  return b.endDate.getTime() - a.endDate.getTime()
}

export function selectTasks(
  tasks: TaskWithAssignmentsDTO[],
  filter: TasksVisibilityFilter,
  now: Date
): TaskWithAssignmentsDTO[] {
  const unfinished: TaskWithAssignmentsDTO[] = []
  const finished: TaskWithAssignmentsDTO[] = []

  for (const task of tasks) {
    if (shouldShowTask(task, now)) unfinished.push(task)
    else finished.push(task)
  }

  switch (filter) {
    case "unfinished":
      return unfinished.sort(byEndDateAsc)
    case "finished":
      return finished.sort(byEndDateDesc)
    case "both":
      unfinished.sort(byEndDateAsc)
      finished.sort(byEndDateDesc)
      return [...unfinished, ...finished]
  }
}
