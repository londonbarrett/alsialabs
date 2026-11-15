"use client"

import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export function TaskAssigneeStack({
  assignments,
}: {
  assignments: TaskAssignmentDTO[]
}) {
  if (assignments.length === 0) return null

  const visible = assignments.slice(0, 3)
  const overflow = assignments.length - visible.length

  return (
    <span className="flex -space-x-2">
      {visible.map((assignment) => (
        <Avatar
          key={assignment.id}
          size="sm"
          className="border-2 border-background"
        >
          <AvatarImage
            src={assignment.userImage ?? undefined}
            alt=""
          />
          <AvatarFallback>
            {(assignment.userName || assignment.userEmail || "")
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
