import { getTableColumns } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { expect, it } from "vitest"

import {
  projectMembershipTable,
  taskAssigneesTable,
  taskAssignmentDetailView,
  taskAssignmentLatestView,
  taskAssignmentsTable,
  tasksTable,
} from "./schema"

it("adds archived and the task_assignee membership table", () => {
  expect(getTableColumns(tasksTable).archived.default).toBe(false)

  const config = getTableConfig(taskAssigneesTable)
  expect(config.name).toBe("task_assignee")
  expect(config.columns.map((c) => c.name)).toEqual(
    expect.arrayContaining([
      "id", "task_id", "user_id", "created_at", "updated_at",
    ])
  )
  const unique = config.indexes.find((i) => i.config.unique)
  expect(
    unique?.config.columns.map((c) => (c as { name: string }).name)
  ).toEqual(expect.arrayContaining(["task_id", "user_id"]))
  expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual(
    expect.arrayContaining(["cascade", "cascade"])
  )
})

it("adds the assignment and membership tables", () => {
  const assignmentColumns = getTableColumns(taskAssignmentsTable)
  for (const column of [
    "id",
    "taskId",
    "userId",
    "status",
    "comment",
    "startDate",
    "endDate",
  ]) {
    expect(assignmentColumns).toHaveProperty(column)
  }

  const membershipColumns = getTableColumns(projectMembershipTable)
  for (const column of ["projectId", "userId", "role"]) {
    expect(membershipColumns).toHaveProperty(column)
  }

  expect(taskAssignmentDetailView).toBeDefined()
  expect(taskAssignmentDetailView.createdAt).toBeDefined()
  expect(taskAssignmentLatestView).toBeDefined()
})

it("keeps the schedule fields and drops the legacy task columns", () => {
  const taskColumns = getTableColumns(tasksTable)
  for (const column of [
    "startDate",
    "endDate",
    "recurrence",
    "interval",
    "daysOfWeek",
    "startTime",
    "endTime",
  ]) {
    expect(taskColumns).toHaveProperty(column)
  }
  for (const column of ["cost", "status", "assigneeId", "routineId", "dueDate"]) {
    expect(taskColumns).not.toHaveProperty(column)
  }
})
