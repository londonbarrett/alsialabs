import { Eye, Pencil, Trash2 } from "lucide-react"
import type { MenuAction } from "@/lib/types"

interface BuildActionMenuActionsInput {
  labels: {
    view: string
    edit: string
    delete: string
  }
  onView?: () => void
  onEdit?: () => void
  /** Opens the confirmation dialog — the caller decides when to actually delete. */
  onRequestDelete: () => void
  canEdit: boolean
  canDelete: boolean
  extraActions?: MenuAction[]
}

/** Builds the ordered action list shared by the desktop icons and mobile menu. */
export function buildActionMenuActions({
  labels,
  onView,
  onEdit,
  onRequestDelete,
  canEdit,
  canDelete,
  extraActions = [],
}: BuildActionMenuActionsInput): MenuAction[] {
  const actions: MenuAction[] = []

  if (onView) {
    actions.push({
      key: "view",
      label: labels.view,
      icon: Eye,
      onSelect: onView,
    })
  }
  if (onEdit && canEdit) {
    actions.push({
      key: "edit",
      label: labels.edit,
      icon: Pencil,
      onSelect: onEdit,
    })
  }

  actions.push(...extraActions)

  if (canDelete) {
    actions.push({
      key: "delete",
      label: labels.delete,
      icon: Trash2,
      onSelect: onRequestDelete,
      destructive: true,
    })
  }

  return actions
}
