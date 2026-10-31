import { describe, expect, it } from "vitest"

import type { CalendarAssignmentDTO } from "@/actions/schemas/calendar"
import { buildCalendarEvents } from "./events"

function assignment(
  overrides: Partial<CalendarAssignmentDTO> = {}
): CalendarAssignmentDTO {
  return {
    assignmentId: "a1",
    taskId: "t1",
    taskName: "Clean the studio",
    status: "todo",
    priority: null,
    startDate: new Date(2026, 9, 30, 9, 0),
    endDate: new Date(2026, 9, 30, 11, 0),
    projectId: "p1",
    projectName: "Home",
    projectColor: "#3b82f6",
    projectOwnerName: "Owner",
    userName: "Ana",
    userImage: null,
    comment: null,
    commentCount: 0,
    recurrence: null,
    ...overrides,
  }
}

const from = new Date(2026, 9, 29)
const to = new Date(2026, 10, 2, 23, 59)

describe("buildCalendarEvents", () => {
  it("groups same-day assignments of one task into one event", () => {
    const events = buildCalendarEvents(
      [
        assignment({ assignmentId: "a1", userName: "Ana" }),
        assignment({ assignmentId: "a2", userName: "Bob" }),
      ],
      from,
      to
    )

    expect(events).toHaveLength(1)
    expect(events[0]?.meta?.assignees).toHaveLength(2)
    expect(events[0]?.title).toBe("Clean the studio")
  })

  it("keeps assignments on different days apart", () => {
    const events = buildCalendarEvents(
      [
        assignment({ assignmentId: "a1" }),
        assignment({
          assignmentId: "a2",
          startDate: new Date(2026, 9, 31, 9, 0),
          endDate: new Date(2026, 9, 31, 11, 0),
        }),
      ],
      from,
      to
    )

    expect(events).toHaveLength(2)
  })
})
