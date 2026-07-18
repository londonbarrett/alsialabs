"use client"

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
import {
  addProjectCollaborator,
  addProjectOwner,
  removeProjectCollaborator,
  removeProjectOwner,
} from "@/lib/actions/project-users"
import { Crown, Users, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ProjectMember } from "./project-detail-view"
import { UserInviteInput } from "./user-invite-input"

interface ProjectPeopleProps {
  projectId: string
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  primaryOwnerId: string
  canManageUsers: boolean
  isOwner: boolean
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function MemberPill({
  member,
  onRemove,
}: {
  member: ProjectMember
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
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

export function ProjectPeople({
  projectId,
  owners,
  collaborators,
  primaryOwnerId,
  canManageUsers,
  isOwner,
}: ProjectPeopleProps) {
  const router = useRouter()
  const t = useTranslations()
  const additionalOwners = owners.filter(
    (o) => o.userId !== primaryOwnerId
  )

  async function handleAddOwner(userId: string) {
    const result = await addProjectOwner(projectId, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleRemoveOwner(userId: string) {
    const result = await removeProjectOwner(projectId, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleAddCollaborator(userId: string) {
    const result = await addProjectCollaborator(projectId, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  async function handleRemoveCollaborator(userId: string) {
    const result = await removeProjectCollaborator(projectId, userId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("projects.detail.tabs.people")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Crown className="h-4 w-4 text-muted-foreground" />
            {t("projects.owners")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {additionalOwners.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("projects.noAdditionalOwners")}
              </p>
            )}
            {additionalOwners.map((o) => (
              <MemberPill
                key={o.userId}
                member={o}
                onRemove={
                  canManageUsers
                    ? () => handleRemoveOwner(o.userId)
                    : undefined
                }
              />
            ))}
          </div>
          {canManageUsers && (
            <div className="mt-3">
              <UserInviteInput
                onSelect={handleAddOwner}
                placeholder={t("projects.addOwner")}
              />
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("projects.collaborators")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {collaborators.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("projects.noCollaborators")}
              </p>
            )}
            {collaborators.map((c) => (
              <MemberPill
                key={c.userId}
                member={c}
                onRemove={
                  isOwner
                    ? () => handleRemoveCollaborator(c.userId)
                    : undefined
                }
              />
            ))}
          </div>
          {isOwner && (
            <div className="mt-3">
              <UserInviteInput
                onSelect={handleAddCollaborator}
                placeholder={t("projects.addCollaborator")}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
