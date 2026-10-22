"use client"

import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface ActionMenuProps {
  entityName: string
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canDelete?: boolean
  onView?: () => void
  children?: React.ReactNode
}

export function ActionMenu({
  entityName,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  onView,
  children,
}: ActionMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const t = useTranslations()

  function handleDelete() {
    onDelete?.()
    setDeleteOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actionMenu.actionsFor", {
                name: entityName,
              })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto">
          {children}
          {onView && (
            <DropdownMenuItem onClick={onView}>
              <Eye className="mr-2 h-4 w-4" />
              {t("actionMenu.view", { name: entityName })}
            </DropdownMenuItem>
          )}
          {onEdit && canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("actionMenu.edit", { name: entityName })}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("actionMenu.deleteItem", { name: entityName })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
