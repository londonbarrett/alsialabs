"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { MenuAction } from "@/lib/types"

interface ActionMenuIconButtonProps {
  action: MenuAction
}

/** One action rendered as a tooltip-labelled icon button in the desktop action row. */
export function ActionMenuIconButton({ action }: ActionMenuIconButtonProps) {
  const Icon = action.icon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={action.destructive ? "destructive" : "ghost"}
            size="icon-sm"
            aria-label={action.label}
            disabled={action.disabled}
            onClick={action.onSelect}
          >
            <Icon aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  )
}
