"use client"

import { ActionMenu } from "@/components/common/action-menu"
import type { MenuAction } from "@/lib/types"
import { UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"

interface ClientActionMenuProps {
  entityName: string
  onEdit?: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
  onView?: () => void
  onInvite?: () => void
  canInvite?: boolean
}

export function ClientActionMenu({
  onInvite,
  canInvite = true,
  ...rest
}: ClientActionMenuProps) {
  const tc = useTranslations("common")
  const actions: MenuAction[] =
    onInvite && canInvite
      ? [
          {
            key: "invite",
            label: tc("invite"),
            icon: UserPlus,
            onSelect: onInvite,
          },
        ]
      : []

  return <ActionMenu {...rest} actions={actions} />
}
