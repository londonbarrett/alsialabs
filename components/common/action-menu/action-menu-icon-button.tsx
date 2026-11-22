"use client"

import { Button } from "@/components/ui/button"
import { cn } from "cn"
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
            variant="ghost"
            size="icon-sm"
            className={cn(
              action.destructive && "text-destructive hover:text-destructive"
            )}
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
