import { describe, expect, it } from "vitest"

import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import { assignmentCounts } from "./filter"

const assignment = (status: string): TaskAssignmentDTO => ({
  id: `assignment-${status}`,
  taskId: "task-1",
  userId: "user-1",
  userName: null,
  userEmail: null,
  userImage: null,
  status: status as TaskAssignmentDTO["status"],
  comment: null,
  startDate: null,
  endDate: null,
})

describe("assignmentCounts", () => {
  it("counts blocked and in_review inside open", () => {
    expect(
      assignmentCounts([
        assignment("todo"),
        assignment("blocked"),
        assignment("in_review"),
        assignment("done"),
      ])
    ).toEqual({ open: 3, blocked: 1, review: 1 })
  })
})
