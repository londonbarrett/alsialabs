"use client"

import { buildActionMenuActions } from "./action-menu-actions"
import { ActionMenuIconButton } from "./action-menu-icon-button"
import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MenuAction } from "@/lib/types"
import { MoreHorizontal } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface ActionMenuProps {
  entityName: string
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canDelete?: boolean
  onView?: () => void
  /** Extra row actions, shown as inline icons on desktop and menu items on mobile. */
  actions?: MenuAction[]
}

export function ActionMenu({
  entityName,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  onView,
  actions,
}: ActionMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const t = useTranslations()
  const tc = useTranslations("common")

  const items = buildActionMenuActions({
    labels: {
      view: tc("view"),
      edit: tc("edit"),
      delete: tc("delete"),
    },
    onView,
    onEdit,
    onRequestDelete: () => setDeleteOpen(true),
    canEdit,
    canDelete,
    extraActions: actions,
  })

  function handleDelete() {
    onDelete?.()
    setDeleteOpen(false)
  }

  if (items.length === 0) return null

  return (
    <>
      <div className="hidden items-center justify-end gap-1 md:flex">
        {items.map((action) => (
          <ActionMenuIconButton key={action.key} action={action} />
        ))}
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actionMenu.actionsFor", {
                  name: entityName,
                })}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-auto">
            {items.map((action) => {
              const Icon = action.icon
              return (
                <DropdownMenuItem
                  key={action.key}
                  onClick={action.onSelect}
                  variant={action.destructive ? "destructive" : "default"}
                  disabled={action.disabled}
                >
                  <Icon aria-hidden="true" />
                  {action.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DestructiveDialog
        open={deleteOpen}
        title={t("common.delete")}
        message={t("common.confirmDelete", { name: entityName })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  )
}
