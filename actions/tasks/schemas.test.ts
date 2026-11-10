import { describe, expect, it } from "vitest"

import { CalendarAssignmentSchema } from "@/actions/legacy/schemas/calendar"
import {
  CreateTaskSchema,
  MyAssignmentSchema,
  TaskAssignmentSchema,
  TaskFormSchema,
} from "@/actions/tasks/schemas"

const base = {
  name: "Task",
  description: "",
  priority: null,
  assigneeIds: [],
}

const window = {
  startDate: "2026-10-30T09:00:00",
  endDate: "2026-10-30T11:00:00",
}

describe("task window schema", () => {
  it("accepts a same-day window", () => {
    expect(TaskFormSchema.safeParse({ ...base, ...window }).success).toBe(
      true
    )
  })

  it("rejects a window crossing midnight", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      startDate: "2026-10-30T23:00:00",
      endDate: "2026-10-31T01:00:00",
    })
    expect(result.success).toBe(false)
  })

  it("rejects an end before the start", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      startDate: "2026-10-30T11:00:00",
      endDate: "2026-10-30T09:00:00",
    })
    expect(result.success).toBe(false)
  })

  it("requires a window for a non-repeating task", () => {
    expect(TaskFormSchema.safeParse(base).success).toBe(false)
  })

  it("requires startTime for a repeating task", () => {
    const result = TaskFormSchema.safeParse({
      ...base,
      recurrence: "daily",
      startTime: "",
    })
    expect(result.success).toBe(false)
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
      projectName: "Project",
      projectColor: "#0f766e",
      projectOwnerName: null,
      role: "collaborator",
      status: "todo",
      comment: null,
      recurrence: null,
      commentCount: 0,
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
