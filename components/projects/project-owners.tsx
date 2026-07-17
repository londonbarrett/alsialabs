import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Crown, X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./project-detail-view"

interface ProjectOwnersProps {
  owners: ProjectMember[]
  primaryOwnerId: string
  availableUsers: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }[]
  canManageUsers: boolean
  onAddOwner: (userId: string) => void
  onRemoveOwner: (userId: string) => void
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ProjectOwners({
  owners,
  primaryOwnerId,
  availableUsers,
  canManageUsers,
  onAddOwner,
  onRemoveOwner,
}: ProjectOwnersProps) {
  const t = useTranslations()

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4" />
            {t("projects.owners")}
          </h3>
          {canManageUsers && availableUsers.length > 0 && (
            <Select onValueChange={onAddOwner}>
              <SelectTrigger className="h-7 w-40">
                <SelectValue placeholder={t("projects.addOwner")} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {owners.map((o) => (
            <div
              key={o.userId}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5"
            >
              <Avatar className="size-6">
                <AvatarImage src={o.userImage ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(o.userName ?? "")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{o.userName || o.userEmail}</span>
              {o.userId === primaryOwnerId && (
                <Crown className="h-3 w-3 text-amber-500" />
              )}
              {canManageUsers && o.userId !== primaryOwnerId && (
                <button
                  onClick={() => onRemoveOwner(o.userId)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
