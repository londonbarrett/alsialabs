'use client'

import { UserPlus } from 'lucide-react'
import { ActionMenu } from '@/components/common/action-menu'
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

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
  return (
    <ActionMenu {...rest}>
      {onInvite && canInvite && (
        <DropdownMenuItem onClick={onInvite}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </DropdownMenuItem>
      )}
    </ActionMenu>
  )
}
