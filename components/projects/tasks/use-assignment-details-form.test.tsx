// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateAssignment } = vi.hoisted(() => ({
  updateAssignment: vi.fn(),
}))

vi.mock("@/stores/project-tasks/use-project-tasks-actions", () => ({
  useProjectTasksActions: () => ({ updateAssignment }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

import type { UseAssignmentDetailsFormParams } from "./use-assignment-details-form"
import { useAssignmentDetailsForm } from "./use-assignment-details-form"

const params: UseAssignmentDetailsFormParams = {
  projectId: "project-1",
  taskId: "task-1",
  assignmentId: "assignment-1",
  cost: "100",
  comment: null,
  terminal: false,
}

describe("useAssignmentDetailsForm", () => {
  beforeEach(() => {
    updateAssignment.mockReset()
  })

  it("is not dirty initially and becomes dirty after a field changes", () => {
    const { result } = renderHook((props) => useAssignmentDetailsForm(props), {
      initialProps: params,
    })

    expect(result.current.isDirty).toBe(false)

    act(() => result.current.setField("comment", "note"))

    expect(result.current.isDirty).toBe(true)
  })

  it("adopts new props while clean", () => {
    const { result, rerender } = renderHook(
      (props) => useAssignmentDetailsForm(props),
      { initialProps: params }
    )

    rerender({ ...params, cost: "200", comment: "from server" })

    expect(result.current.values.cost).toBe("200")
    expect(result.current.values.comment).toBe("from server")
  })

  it("ignores new props while dirty or submitting", async () => {
    const { result, rerender } = renderHook(
      (props) => useAssignmentDetailsForm(props),
      { initialProps: params }
    )
    act(() => result.current.setField("comment", "note"))

    const changed = { ...params, cost: "200", comment: "from server" }
    rerender(changed)
    expect(result.current.values.cost).toBe("100")
    expect(result.current.values.comment).toBe("note")

    updateAssignment.mockResolvedValue({ success: true })
    await act(async () => {
      await result.current.save()
    })
    rerender(changed)

    expect(result.current.values.cost).toBe("200")
    expect(result.current.values.comment).toBe("from server")
  })

  it("sends both fields and resets the baseline on success", async () => {
    updateAssignment.mockResolvedValue({ success: true })
    const { result } = renderHook((props) => useAssignmentDetailsForm(props), {
      initialProps: params,
    })

    act(() => {
      result.current.setField("cost", "150")
      result.current.setField("comment", "note")
    })
    await act(async () => {
      await result.current.save()
    })

    expect(updateAssignment).toHaveBeenCalledWith(
      "project-1",
      "task-1",
      "assignment-1",
      "150",
      "note",
      "100",
      false
    )
    expect(result.current.isDirty).toBe(false)
  })

  it("keeps saved values when a fetched history row's props stay stale", async () => {
    updateAssignment.mockResolvedValue({ success: true })
    const { result, rerender } = renderHook(
      (props) => useAssignmentDetailsForm(props),
      { initialProps: params }
    )

    act(() => {
      result.current.setField("cost", "150")
      result.current.setField("comment", "note")
    })
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.values.cost).toBe("150")
    expect(result.current.values.comment).toBe("note")
    expect(result.current.isDirty).toBe(false)

    // The history panel keeps closed rows in its own `displayed` list, so the
    // host never re-renders this row with the new cost/comment props. The old
    // props must not undo `reset(submitted)`.
    rerender(params)
    expect(result.current.values.cost).toBe("150")
    expect(result.current.values.comment).toBe("note")
    expect(result.current.isDirty).toBe(false)
  })

  it("treats a reformatted server cost as the saved value, then adopts later props", async () => {
    updateAssignment.mockResolvedValue({ success: true })
    const { result, rerender } = renderHook(
      (props) => useAssignmentDetailsForm(props),
      { initialProps: params }
    )

    act(() => {
      result.current.setField("cost", "150")
      result.current.setField("comment", "note")
    })
    await act(async () => {
      await result.current.save()
    })

    // decimal(12,2) reads back as "150.00"; that is the same saved value, not
    // a fresh server edit, and must not clobber the draft.
    rerender({ ...params, cost: "150.00", comment: "note" })
    expect(result.current.values.cost).toBe("150")
    expect(result.current.values.comment).toBe("note")
    expect(result.current.isDirty).toBe(false)

    // Once props genuinely advance, they are adopted normally.
    rerender({ ...params, cost: "200", comment: "later" })
    expect(result.current.values.cost).toBe("200")
    expect(result.current.values.comment).toBe("later")
    expect(result.current.isDirty).toBe(false)
  })

  it("keeps the draft and isDirty true when the mutation fails", async () => {
    updateAssignment.mockResolvedValue({ success: false })
    const { result, rerender } = renderHook(
      (props) => useAssignmentDetailsForm(props),
      { initialProps: params }
    )

    act(() => result.current.setField("comment", "note"))
    await act(async () => {
      await result.current.save()
    })

    // The store discards its optimistic pend, so the host re-renders with the
    // pre-edit props. The failed-save guard must keep the typed note intact.
    rerender({ ...params, cost: "100", comment: null })
    expect(result.current.values.comment).toBe("note")
    expect(result.current.values.cost).toBe("100")
    expect(result.current.isDirty).toBe(true)
  })
})
