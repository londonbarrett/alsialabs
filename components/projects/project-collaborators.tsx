import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./project-detail-view"
import { UserInviteInput } from "./user-invite-input"

interface ProjectCollaboratorsProps {
  collaborators: ProjectMember[]
  isOwner: boolean
  onAddCollaborator: (userId: string) => void
  onRemoveCollaborator: (userId: string) => void
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ProjectCollaborators({
  collaborators,
  isOwner,
  onAddCollaborator,
  onRemoveCollaborator,
}: ProjectCollaboratorsProps) {
  const t = useTranslations()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("projects.collaborators")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {collaborators.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("projects.noCollaborators")}
            </p>
          )}
          {collaborators.map((c) => (
            <div
              key={c.userId}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5"
            >
              <Avatar className="size-6">
                <AvatarImage src={c.userImage ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(c.userName ?? "")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{c.userName || c.userEmail}</span>
              {isOwner && (
                <button
                  onClick={() => onRemoveCollaborator(c.userId)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <div className="mt-3">
            <UserInviteInput
              onSelect={onAddCollaborator}
              placeholder={t("projects.addCollaborator")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
