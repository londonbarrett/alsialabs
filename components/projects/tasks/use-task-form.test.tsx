// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { TaskWithAssignmentsSchema } from "@/actions/tasks/schemas"

const context = vi.hoisted(() => ({
  timeZone: "UTC",
  members: [] as Array<{ userId: string }>,
}))

vi.mock("@/stores/project-context/use-project-context-state", () => ({
  useProjectContextState: () => ({
    members: context.members,
    project: { timeZone: context.timeZone },
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

import { useTaskForm } from "./use-task-form"

function makeTask(
  overrides: Partial<TaskWithAssignmentsDTO> = {}
): TaskWithAssignmentsDTO {
  return TaskWithAssignmentsSchema.parse({
    id: "task-1",
    projectId: "project-1",
    name: "Existing task",
    description: "",
    priority: null,
    cost: "",
    startDate: null,
    endDate: null,
    recurrence: null,
    interval: 1,
    daysOfWeek: null,
    startTime: null,
    endTime: null,
    archived: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    assignments: [],
    assigneeIds: [],
    commentCount: 0,
    closedCount: 0,
    ...overrides,
  })
}

describe("useTaskForm", () => {
  beforeEach(() => {
    context.timeZone = "UTC"
    context.members = []
  })

  it("seeds an edited task in the project zone, not the browser's", () => {
    context.timeZone = "America/New_York"
    const task = makeTask({
      name: "Kickoff",
      startDate: new Date("2026-01-05T02:00:00Z"), // Jan 4, 21:00 in New York
      endDate: new Date("2026-01-05T04:00:00Z"), // Jan 4, 23:00 in New York
      startTime: "21:00",
      endTime: "23:00",
    })

    const { result } = renderHook(() =>
      useTaskForm({ task, onSubmit: vi.fn(), onCancel: vi.fn() })
    )

    expect(result.current.values.name).toBe("Kickoff")
    expect(result.current.values.startDate).toBe("2026-01-04")
    expect(result.current.values.endDate).toBe("2026-01-04")
    expect(result.current.values.allDay).toBe(false)
    expect(result.current.values.startTime).toBe("21:00")
  })

  it("keeps the wizard on step one until a name is present", () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: vi.fn(), onCancel: vi.fn() })
    )

    act(() => result.current.goNext())

    expect(result.current.step).toBe(1)
    expect(result.current.errors.name).toBe("projects.tasks.nameRequired")

    act(() => {
      result.current.onNameChange("Payroll")
      result.current.goNext()
    })

    expect(result.current.step).toBe(2)
    expect(result.current.errors.name).toBeUndefined()
  })

  it("submits an all-day one-off task with empty times", async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit, onCancel: vi.fn() })
    )

    act(() => {
      result.current.onNameChange("  Rent  ")
      result.current.onEndDateChange("2026-02-10")
    })
    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Rent",
      cost: "",
      description: "",
      priority: null,
      assigneeIds: [],
      unassignAs: {},
      startDate: "2026-02-10",
      endDate: "2026-02-10",
      recurrence: null,
      interval: 1,
      daysOfWeek: [],
      startTime: "",
      endTime: "",
    })
  })

  it("requires a weekday before submitting a weekly repeating task", async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit, onCancel: vi.fn() })
    )

    act(() => {
      result.current.onNameChange("Standup")
      result.current.handleRepeatChange(true)
      result.current.onRecurrenceChange("weekly")
    })
    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.errors.daysOfWeek).toBe(
      "projects.routines.atLeastOneDay"
    )

    act(() => result.current.toggleDay("mon"))
    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: "weekly",
        daysOfWeek: ["mon"],
        startTime: "",
        endTime: "",
      })
    )
  })

  it("records the disposition of an assignee removed from the roster", () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: vi.fn(), onCancel: vi.fn() })
    )

    act(() => result.current.recordDisposition("user-2", "cancelled"))

    expect(result.current.values.unassignAs).toEqual({
      "user-2": "cancelled",
    })
  })
})
