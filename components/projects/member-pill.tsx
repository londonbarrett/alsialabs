import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { ArrowDownUp, X } from "lucide-react"

type MemberLike = {
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

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
  roleLabel,
  onRemove,
  onToggleRole,
  toggleRoleTitle,
}: {
  member: MemberLike
  roleLabel?: string
  onRemove?: () => void
  onToggleRole?: () => void
  toggleRoleTitle?: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
      <Avatar className="size-8">
        <AvatarImage src={member.userImage ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {initials(member.userName ?? "")}
        </AvatarFallback>
      </Avatar>
      <span className="mr-2 flex flex-col">
        <span className="text-sm">
          {member.userName || member.userEmail}
        </span>
        {member.userName && member.userEmail && (
          <span className="text-xs text-muted-foreground">
            {member.userEmail}
          </span>
        )}
      </span>
      {roleLabel && (
        <span className="mr-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {roleLabel}
        </span>
      )}
      {onToggleRole && (
        <button
          onClick={onToggleRole}
          title={toggleRoleTitle}
          aria-label={toggleRoleTitle}
          className="mr-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowDownUp className="h-3 w-3" />
        </button>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="mr-2 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
