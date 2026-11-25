import { describe, expect, it } from "vitest"

import { CalendarAssignmentSchema } from "@/actions/calendar/schemas"
import {
  ArchiveTaskSchema,
  CreateTaskSchema,
  MyAssignmentSchema,
  TaskAssignmentSchema,
  TaskFormSchema,
  TaskRecordSchema,
  TaskWithAssignmentsSchema,
  UnarchiveTaskSchema,
  UpdateAssignmentCostSchema,
  UpdateTaskSchema,
} from "@/actions/tasks/schemas"

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

const minimalRow = {
  id: "t1",
  projectId: "p1",
  name: "Task",
  description: null,
  priority: null,
  cost: "0",
  startDate: null,
  endDate: null,
  recurrence: null,
  interval: 1,
  daysOfWeek: null,
  startTime: null,
  endTime: null,
  createdAt: new Date("2026-11-01T09:00:00Z"),
  updatedAt: new Date("2026-11-01T09:00:00Z"),
}

const base = {
  name: "Task",
  description: "",
  priority: null,
  assigneeIds: [],
}

const window = {
  startDate: "2026-10-30",
  endDate: "2026-10-30",
  startTime: "09:00",
  endTime: "11:00",
}

const validUpdate = {
  ...base,
  ...window,
  projectId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  taskId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
}

describe("task window schema", () => {
  it("accepts a same-day window", () => {
    expect(
      TaskFormSchema.safeParse({ ...base, ...window }).success
    ).toBe(true)
  })

  it("rejects a window crossing midnight", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      startDate: "2026-10-30",
      endDate: "2026-10-31",
      startTime: "23:00",
      endTime: "01:00",
    })
    expect(result.success).toBe(false)
  })

  it("rejects an end before the start", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      startDate: "2026-10-30",
      endDate: "2026-10-29",
      startTime: "11:00",
      endTime: "09:00",
    })
    expect(result.success).toBe(false)
  })

  it("requires a window for a non-repeating task", () => {
    expect(TaskFormSchema.safeParse(base).success).toBe(false)
  })

  it("accepts a repeating task without a startTime (all-day)", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      recurrence: "daily",
      startTime: "",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a repeating task without a window", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      recurrence: "weekly",
      startTime: "08:00",
      endTime: "09:00",
    })
    expect(result.success).toBe(true)
  })

  it("extends to the create schema with a project id", () => {
    const result = CreateTaskSchema.safeParse({
      ...base,
      ...window,
      projectId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(true)
  })

  it("accepts an optional unassignAs record on UpdateTaskSchema", () => {
    expect(
      UpdateTaskSchema.safeParse({
        ...validUpdate,
        unassignAs: { u1: "done" },
      }).success
    ).toBe(true)
    expect(
      UpdateTaskSchema.safeParse({
        ...validUpdate,
        unassignAs: { u1: "paused" },
      }).success
    ).toBe(false)
  })
})

describe("assignment dates from the detail view", () => {
  /**
   * The view's date columns are `sql<>`-typed, so drizzle hands them back as
   * the driver's raw strings instead of Dates. Every schema that validates a
   * view row has to accept that shape.
   */
  const rawDates = {
    startDate: "2026-11-03 09:00:00",
    endDate: "2026-11-03 11:00:00",
  }

  it("coerces raw strings into Dates for MyAssignmentSchema", () => {
    const parsed = MyAssignmentSchema.parse({
      assignmentId: "a1",
      taskId: "t1",
      projectId: "p1",
      name: "Task",
      description: null,
      priority: null,
      cost: "0",
      projectName: "Project",
      projectColor: "#0f766e",
      projectOwnerName: null,
      role: "collaborator",
      status: "todo",
      comment: null,
      recurrence: null,
      commentCount: 0,
      timeZone: "America/Bogota",
      startTime: "09:00",
      ...rawDates,
    })

    expect(parsed.startDate).toBeInstanceOf(Date)
    expect(parsed.endDate).toBeInstanceOf(Date)
  })

  it("coerces raw strings into Dates for TaskAssignmentSchema", () => {
    const parsed = TaskAssignmentSchema.parse({
      id: "a1",
      taskId: "t1",
      userId: "u1",
      userName: null,
      userEmail: null,
      userImage: null,
      status: "todo",
      comment: null,
      cost: "0",
      timeZone: "America/Bogota",
      startTime: "09:00",
      ...rawDates,
    })

    expect(parsed.startDate).toBeInstanceOf(Date)
    expect(parsed.endDate).toBeInstanceOf(Date)
  })

  it("coerces raw strings into Dates for CalendarAssignmentSchema", () => {
    const parsed = CalendarAssignmentSchema.parse({
      assignmentId: "a1",
      taskId: "t1",
      taskName: "Task",
      status: "todo",
      priority: null,
      timeZone: "America/Bogota",
      startTime: "09:00",
      dateKey: "2026-10-30",
      projectId: "p1",
      projectName: "Project",
      projectColor: "#0f766e",
      projectOwnerName: null,
      userName: null,
      userImage: null,
      comment: null,
      commentCount: 0,
      recurrence: null,
      ...rawDates,
    })

    expect(parsed.startDate).toBeInstanceOf(Date)
    expect(parsed.endDate).toBeInstanceOf(Date)
  })
})

describe("assignment cost schema", () => {
  const costInput = {
    projectId: PROJECT_ID,
    assignmentId: TASK_ID,
  }

  it("accepts decimal costs and a trailing separator", () => {
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "12.50" })
        .success
    ).toBe(true)
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "12." })
        .success
    ).toBe(true)
  })

  it("rejects negative, non-numeric, and over-precise costs", () => {
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "-5" })
        .success
    ).toBe(false)
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "abc" })
        .success
    ).toBe(false)
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "1.234" })
        .success
    ).toBe(false)
  })

  it("accepts a whole-unit cost and an empty field", () => {
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "120" })
        .success
    ).toBe(true)
    expect(
      UpdateAssignmentCostSchema.safeParse({ ...costInput, cost: "" })
        .success
    ).toBe(true)
  })
})

describe("archive and assignee roster schemas", () => {
  it("carries archived and the membership roster on task DTOs", () => {
    expect(TaskRecordSchema.parse({ ...minimalRow, archived: false }))
      .toMatchObject({ archived: false })
    expect(
      TaskWithAssignmentsSchema.parse({
        ...minimalRow, archived: true, assigneeIds: ["u1"],
        assignments: [], commentCount: 0, closedCount: 0,
      })
    ).toMatchObject({ archived: true, assigneeIds: ["u1"] })
  })

  it("validates archive and unarchive payloads", () => {
    expect(ArchiveTaskSchema.parse({
      projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "done",
    })).toEqual({ projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "done" })
    expect(ArchiveTaskSchema.safeParse({
      projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "paused",
    }).success).toBe(false)
    expect(UnarchiveTaskSchema.parse({ projectId: PROJECT_ID, taskId: TASK_ID }))
      .toEqual({ projectId: PROJECT_ID, taskId: TASK_ID })
  })
})

describe("wall-clock form dates", () => {
  const wallClock = {
    startDate: "2026-11-25",
    endDate: "2026-11-25",
    startTime: "09:00",
    endTime: "11:00",
  }

  it("accepts a YYYY-MM-DD window with explicit time strings", () => {
    expect(TaskFormSchema.safeParse({ ...base, ...wallClock }).success).toBe(
      true
    )
  })

  it("rejects an ISO timestamp with a time component", () => {
    expect(
      TaskFormSchema.safeParse({
        ...base,
        startDate: "2026-11-25T09:00:00.000Z",
        endDate: "2026-11-25T11:00:00.000Z",
      }).success
    ).toBe(false)
  })

  it("rejects a timed task with no endTime", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      ...wallClock,
      endTime: "",
    })
    expect(result.success).toBe(false)
  })

  it("accepts an all-day task with empty time strings", () => {
    expect(
      TaskFormSchema.safeParse({
        ...base,
        startDate: "2026-11-25",
        endDate: "2026-11-25",
        startTime: "",
        endTime: "",
      }).success
    ).toBe(true)
  })
})

describe("time zone DTO fields", () => {
  const assignment = {
    id: "a1",
    taskId: "t1",
    userId: "u1",
    userName: null,
    userEmail: null,
    userImage: null,
    status: "todo",
    comment: null,
    cost: "0",
    startDate: new Date("2026-11-25T14:00:00.000Z"),
    endDate: new Date("2026-11-25T16:00:00.000Z"),
    timeZone: "America/Bogota",
    startTime: "09:00",
  }

  it("carries timeZone and startTime on TaskAssignmentSchema", () => {
    expect(TaskAssignmentSchema.parse(assignment)).toMatchObject({
      timeZone: "America/Bogota",
      startTime: "09:00",
    })
  })

  it("carries timeZone and startTime on MyAssignmentSchema, never allDay", () => {
    const parsed = MyAssignmentSchema.parse({
      assignmentId: "a1",
      taskId: "t1",
      projectId: "p1",
      name: "Task",
      description: null,
      priority: null,
      projectName: "Project",
      projectColor: "#0f766e",
      projectOwnerName: null,
      role: "collaborator",
      status: "todo",
      comment: null,
      cost: "0",
      recurrence: null,
      commentCount: 0,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      timeZone: "Europe/Madrid",
      startTime: null,
    })
    expect(parsed).toMatchObject({
      timeZone: "Europe/Madrid",
      startTime: null,
    })
    expect(parsed).not.toHaveProperty("allDay")
  })
})
