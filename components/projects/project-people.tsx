"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectPeopleActions } from "@/stores/project-context/use-project-people-actions"
import { Crown, Shield, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { MemberPill } from "./member-pill"
import { UserInviteInput } from "./user-invite-input"

export function ProjectPeople() {
  const t = useTranslations()
  const {
    addAdmin,
    removeAdmin,
    addCollaborator,
    removeCollaborator,
    setRole,
  } = useProjectPeopleActions()
  const { members, isOwner, isAdmin } = useProjectContextState()

  const canManageAdmins = isOwner
  const canManageCollaborators = isOwner || isAdmin

  const primaryOwner = members.find((m) => m.isPrimaryOwner) ?? null
  const admins = members.filter((m) => m.role === "admin")
  const collaborators = members.filter((m) => m.role === "collaborator")

  const allMemberIds = useMemo(
    () => members.map((m) => m.userId),
    [members]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("common.people")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Crown className="h-4 w-4 text-muted-foreground" />
            {t("projects.roles.owner")}
          </h3>
          {primaryOwner && (
            <MemberPill
              member={primaryOwner}
              roleLabel={t("projects.roles.owner")}
            />
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-muted-foreground" />
            {t("projects.roles.admin")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {admins.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("projects.noAdditionalOwners")}
              </p>
            )}
            {admins.map((admin) => (
              <MemberPill
                key={admin.userId}
                member={admin}
                roleLabel={t("projects.roles.admin")}
                onRemove={
                  canManageAdmins
                    ? () => removeAdmin(admin.userId)
                    : undefined
                }
                onToggleRole={
                  canManageAdmins
                    ? () => setRole(admin.userId, "collaborator")
                    : undefined
                }
                toggleRoleTitle={t("projects.roles.makeCollaborator")}
              />
            ))}
          </div>
          {canManageAdmins && (
            <div className="mt-3">
              <UserInviteInput
                onSelect={addAdmin}
                placeholder={t("projects.addOwner")}
                excludedIds={allMemberIds}
              />
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("projects.roles.collaborator")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {collaborators.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("projects.noCollaborators")}
              </p>
            )}
            {collaborators.map((collaborator) => (
              <MemberPill
                key={collaborator.userId}
                member={collaborator}
                roleLabel={t("projects.roles.collaborator")}
                onRemove={
                  canManageCollaborators
                    ? () => removeCollaborator(collaborator.userId)
                    : undefined
                }
                onToggleRole={
                  canManageAdmins
                    ? () => setRole(collaborator.userId, "admin")
                    : undefined
                }
                toggleRoleTitle={t("projects.roles.makeAdmin")}
              />
            ))}
          </div>
          {canManageCollaborators && (
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
