import { getTableColumns } from "drizzle-orm"
import { expect, it } from "vitest"

import {
  projectMembershipTable,
  taskAssignmentDetailView,
  taskAssignmentsTable,
  tasksTable,
} from "./schema"

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
})

it("adds the recurring fields without removing the legacy ones", () => {
  const taskColumns = getTableColumns(tasksTable)
  for (const column of [
    "startDate",
    "endDate",
    "recurrence",
    "interval",
    "daysOfWeek",
    "startTime",
    "endTime",
    "cost",
    "status",
    "assigneeId",
    "routineId",
  ]) {
    expect(taskColumns).toHaveProperty(column)
  }
})
