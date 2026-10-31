import { describe, expect, it } from "vitest"

import {
  CreateTaskV2Schema,
  TaskFormSchema,
} from "@/actions/schemas/task"

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
    const result = CreateTaskV2Schema.safeParse({
      ...base,
      ...window,
      projectId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(true)
  })
})
