import { Archive, Eye, Pencil, Trash2 } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import type { MenuAction } from "@/lib/types"
import { buildActionMenuActions } from "./action-menu-actions"

const labels = { view: "View", edit: "Edit", delete: "Delete" }

describe("buildActionMenuActions", () => {
  it("builds view, edit and delete actions with short labels", () => {
    const onView = vi.fn()
    const onEdit = vi.fn()
    const onRequestDelete = vi.fn()

    const actions = buildActionMenuActions({
      labels,
      onView,
      onEdit,
      onRequestDelete,
      canEdit: true,
      canDelete: true,
    })

    expect(actions).toEqual([
      { key: "view", label: "View", icon: Eye, onSelect: onView },
      { key: "edit", label: "Edit", icon: Pencil, onSelect: onEdit },
      {
        key: "delete",
        label: "Delete",
        icon: Trash2,
        onSelect: onRequestDelete,
        destructive: true,
      },
    ])
  })

  it("omits actions the user has no handler or permission for", () => {
    const actions = buildActionMenuActions({
      labels,
      onRequestDelete: vi.fn(),
      canEdit: false,
      canDelete: false,
    })

    expect(actions).toEqual([])
  })

  it("routes delete through the confirmation callback", () => {
    const onRequestDelete = vi.fn()
    const actions = buildActionMenuActions({
      labels,
      onRequestDelete,
      canEdit: false,
      canDelete: true,
    })

    actions.find((action) => action.key === "delete")?.onSelect()

    expect(onRequestDelete).toHaveBeenCalledOnce()
  })

  it("places extra actions between edit and the destructive delete", () => {
    const archive: MenuAction = {
      key: "archive",
      label: "Archive",
      icon: Archive,
      onSelect: vi.fn(),
    }

    const actions = buildActionMenuActions({
      labels,
      onEdit: vi.fn(),
      onRequestDelete: vi.fn(),
      canEdit: true,
      canDelete: true,
      extraActions: [archive],
    })

    expect(actions.map((action) => action.key)).toEqual([
      "edit",
      "archive",
      "delete",
    ])
  })
})
