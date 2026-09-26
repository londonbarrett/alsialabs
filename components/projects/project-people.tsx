"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useProjectContext } from "@/stores/use-project-context"
import { useProjectMemberActions } from "@/stores/use-project-member-actions"
import { Crown, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { MemberPill } from "./member-pill"
import { UserInviteInput } from "./user-invite-input"

export function ProjectPeople() {
  const t = useTranslations()
  const { addOwner, removeOwner, addCollaborator, removeCollaborator } =
    useProjectMemberActions()
  const { project, owners, collaborators, canManageUsers, isOwner } =
    useProjectContext()
  const primaryOwnerId = project.primaryOwnerId
  const primaryOwner = owners.find((o) => o.userId === primaryOwnerId)
  const additionalOwners = owners.filter(
    (o) => o.userId !== primaryOwnerId
  )
  const allMemberIds = useMemo(
    () => [
      ...owners.map((o) => o.userId),
      ...collaborators.map((c) => c.userId),
    ],
    [owners, collaborators]
  )

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
            {t("projects.primaryOwner")}
          </h3>
          {primaryOwner && <MemberPill member={primaryOwner} />}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
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
                    ? () => removeOwner(o.userId)
                    : undefined
                }
              />
            ))}
          </div>
          {canManageUsers && (
            <div className="mt-3">
              <UserInviteInput
                onSelect={addOwner}
                placeholder={t("projects.addOwner")}
                excludedIds={allMemberIds}
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
                    ? () => removeCollaborator(c.userId)
                    : undefined
                }
              />
            ))}
          </div>
          {isOwner && (
            <div className="mt-3">
              <UserInviteInput
                onSelect={addCollaborator}
                placeholder={t("projects.addCollaborator")}
                excludedIds={allMemberIds}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
