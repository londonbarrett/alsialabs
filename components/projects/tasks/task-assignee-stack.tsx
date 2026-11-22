"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import type { TaskAssigneeIdentity } from "@/lib/types"

export function TaskAssigneeStack({
  assignees,
}: {
  assignees: TaskAssigneeIdentity[]
}) {
  if (assignees.length === 0) return null

  const visible = assignees.slice(0, 3)
  const overflow = assignees.length - visible.length

  return (
    <span className="flex -space-x-2">
      {visible.map((assignee) => (
        <Avatar
          key={assignee.userId}
          size="sm"
          className="border-2 border-background"
        >
          <AvatarImage
            src={assignee.userImage ?? undefined}
            alt=""
          />
          <AvatarFallback>
            {(assignee.userName || assignee.userEmail || "?")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs text-muted-foreground">
          +{overflow}
        </span>
      )}
    </span>
  )
}
