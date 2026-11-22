import { Archive, ArchiveRestore } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import { createTaskArchiveAction } from "./task-archive-action"

const labels = { archive: "Archive", unarchive: "Unarchive" }

function makeInput({
  archived = false,
  assignments = [],
  canArchive = true,
}: {
  archived?: boolean
  assignments?: { status: string }[]
  canArchive?: boolean
} = {}) {
  return {
    labels,
    canArchive,
    task: { archived, assignments },
    onArchiveRequest: vi.fn(),
    onArchiveDirect: vi.fn(),
    onUnarchive: vi.fn(),
  }
}

describe("createTaskArchiveAction", () => {
  it("returns no action when the user cannot archive", () => {
    const action = createTaskArchiveAction(makeInput({ canArchive: false }))

    expect(action).toBeNull()
  })

  it("builds an unarchive action for archived tasks", () => {
    const input = makeInput({ archived: true })

    const action = createTaskArchiveAction(input)

    expect(action).toEqual({
      key: "archive",
      label: "Unarchive",
      icon: ArchiveRestore,
      onSelect: input.onUnarchive,
    })
  })

  it("asks which status to close when an assignment is still open", () => {
    const input = makeInput({ assignments: [{ status: "in_progress" }] })

    const action = createTaskArchiveAction(input)
    action?.onSelect()

    expect(action?.icon).toBe(Archive)
    expect(input.onArchiveRequest).toHaveBeenCalledOnce()
    expect(input.onArchiveDirect).not.toHaveBeenCalled()
  })

  it("archives directly when no assignment is open", () => {
    const input = makeInput({ assignments: [{ status: "done" }] })

    const action = createTaskArchiveAction(input)
    action?.onSelect()

    expect(action?.label).toBe("Archive")
    expect(input.onArchiveDirect).toHaveBeenCalledOnce()
    expect(input.onArchiveRequest).not.toHaveBeenCalled()
  })
})
