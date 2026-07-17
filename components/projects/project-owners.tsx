import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Crown, X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./project-detail-view"
import { UserInviteInput } from "./user-invite-input"

interface ProjectOwnersProps {
  owners: ProjectMember[]
  primaryOwnerId: string
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
  canManageUsers,
  onAddOwner,
  onRemoveOwner,
}: ProjectOwnersProps) {
  const t = useTranslations()
  const additionalOwners = owners.filter(
    (o) => o.userId !== primaryOwnerId
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-4 w-4" />
          {t("projects.owners")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {additionalOwners.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("projects.noAdditionalOwners")}
            </p>
          )}
          {additionalOwners.map((o) => (
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
              <span className="text-sm">
                {o.userName || o.userEmail}
              </span>
              {canManageUsers && (
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
        {canManageUsers && (
          <div className="mt-4">
            <UserInviteInput
              onSelect={onAddOwner}
              placeholder={t("projects.addOwner")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
