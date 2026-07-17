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
import { Users, X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ProjectMember } from "./project-detail-view"

interface ProjectCollaboratorsProps {
  collaborators: ProjectMember[]
  availableUsers: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }[]
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
  availableUsers,
  isOwner,
  onAddCollaborator,
  onRemoveCollaborator,
}: ProjectCollaboratorsProps) {
  const t = useTranslations()

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            {t("projects.collaborators")}
          </h3>
          {isOwner && availableUsers.length > 0 && (
            <Select onValueChange={onAddCollaborator}>
              <SelectTrigger className="h-7 w-40">
                <SelectValue
                  placeholder={t("projects.addCollaborator")}
                />
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
      </CardContent>
    </Card>
  )
}
