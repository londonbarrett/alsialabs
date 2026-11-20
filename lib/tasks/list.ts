import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { isOpenAssignment } from "@/lib/tasks/filter"

export type TasksVisibilityFilter = "open" | "archived"

/**
 * Rows to render for a task. Non-repeating tasks load their full
 * assignment history, so every row shows. Repeating tasks stay slim:
 * while any assignment is still open the finished rows are history
 * noise, but once every row is terminal the store's
 * one-row-per-assignee invariant makes the whole set exactly each
 * assignee's last finished row, so it stays visible.
 */
export function visibleAssignments(
  assignments: TaskAssignmentDTO[],
  recurrence: "daily" | "weekly" | null
): TaskAssignmentDTO[] {
  if (recurrence === null) return assignments
  return assignments.some(isOpenAssignment)
    ? assignments.filter(isOpenAssignment)
    : assignments
}

/**
 * Closed rows by occurrence start, newest first; rows without a usable
 * `startDate` sort last and ties keep their input order (Array#sort is
 * stable). The history panel's merged region always renders through
 * this — server paging (`createdAt DESC` + offset) is an
 * implementation detail that must never leak into display order.
 * `sortAssignments` is deliberately untouched: its open-first, asc
 * semantics serve other consumers.
 */
export function sortClosedRows<
  T extends { startDate: Date | string | null },
>(rows: T[]): T[] {
  const start = (value: Date | string | null): number | null => {
    if (!value) return null
    const time =
      value instanceof Date ? value.getTime() : Date.parse(value)
    return Number.isNaN(time) ? null : time
  }

  return [...rows].sort((a, b) => {
    const at = start(a.startDate)
    const bt = start(b.startDate)
    if (at === bt) return 0
    if (at === null) return 1
    if (bt === null) return -1
    return bt - at
  })
}

/**
 * The history panel's open→terminal absorption decision: rows that are
 * terminal in the store now, were open in the previous render, and are
 * not displayed yet — the just-closed assignments the panel must copy
 * into its own state so the closed badge renders at pend, in place,
 * and survives the spawn commit dropping the store row. Rows that were
 * never open while mounted (a mixed task's old slim history) are left
 * behind Load More, and already-displayed copies are never re-added.
 */
export function freshlyClosedRows(
  prevOpenIds: ReadonlySet<string>,
  storeTerminal: TaskAssignmentDTO[],
  displayedIds: ReadonlySet<string>
): TaskAssignmentDTO[] {
  return storeTerminal.filter(
    (row) => prevOpenIds.has(row.id) && !displayedIds.has(row.id)
  )
}

/**
 * The history panel's closed region: the store rows it starts from
 * (`zeroOpenScope`, only when the task has no open assignment) plus
 * everything fetched or absorbed so far (`displayed`), deduped by
 * assignment id and ordered at render so overlapping pages, absorbed
 * open→terminal copies, and store rows can never duplicate or jumble
 * the list.
 */
export function mergeClosedRows(
  zeroOpenScope: TaskAssignmentDTO[],
  displayed: TaskAssignmentDTO[]
): TaskAssignmentDTO[] {
  const seen = new Set<string>()
  const merged: TaskAssignmentDTO[] = []
  for (const row of [...zeroOpenScope, ...displayed]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return sortClosedRows(merged)
}

const byEndDateAsc = (
  a: TaskWithAssignmentsDTO,
  b: TaskWithAssignmentsDTO
): number => {
  if (!a.endDate) return b.endDate ? 1 : 0
  if (!b.endDate) return -1
  return a.endDate.getTime() - b.endDate.getTime()
}

export function selectTasks(
  tasks: TaskWithAssignmentsDTO[],
  filter: TasksVisibilityFilter
): TaskWithAssignmentsDTO[] {
  const wantArchived = filter === "archived"
  return tasks
    .filter((task) => task.archived === wantArchived)
    .sort(byEndDateAsc)
}
