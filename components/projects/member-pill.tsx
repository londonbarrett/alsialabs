import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import type { ProjectMember } from "@/lib/types"
import { X } from "lucide-react"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function MemberPill({
  member,
  onRemove,
}: {
  member: ProjectMember
  onRemove?: () => void
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
      <Avatar className="size-6">
        <AvatarImage src={member.userImage ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {initials(member.userName ?? "")}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm">
        {member.userName || member.userEmail}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
