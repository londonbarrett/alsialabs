"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectPeopleActions } from "@/stores/project-context/use-project-people-actions"
import { Crown, Shield, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
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
  const [pendingRemoval, setPendingRemoval] = useState<{
    userId: string
    name: string
    kind: "admin" | "collaborator"
  } | null>(null)

  const canManageAdmins = isOwner
  const canManageCollaborators = isOwner || isAdmin

  const primaryOwner = members.find((m) => m.isPrimaryOwner) ?? null
  const admins = members.filter((m) => m.role === "admin")
  const collaborators = members.filter((m) => m.role === "collaborator")

  const allMemberIds = useMemo(
    () => members.map((m) => m.userId),
    [members]
  )

  function confirmRemoval() {
    if (!pendingRemoval) return
    const remove =
      pendingRemoval.kind === "admin" ? removeAdmin : removeCollaborator
    void remove(pendingRemoval.userId)
    setPendingRemoval(null)
  }

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
                    ? () =>
                        setPendingRemoval({
                          userId: admin.userId,
                          name:
                            admin.userName || admin.userEmail || "",
                          kind: "admin",
                        })
                    : undefined
                }
                onToggleRole={
                  canManageAdmins
                    ? () => setRole(admin.userId, "collaborator")
                    : undefined
                }
                toggleRoleTitle={t("projects.roles.makeCollaborator")}
                removeLabel={t("projects.removeMember.removeButton", {
                  name: admin.userName || admin.userEmail || "",
                })}
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
                    ? () =>
                        setPendingRemoval({
                          userId: collaborator.userId,
                          name:
                            collaborator.userName ||
                            collaborator.userEmail ||
                            "",
                          kind: "collaborator",
                        })
                    : undefined
                }
                onToggleRole={
                  canManageAdmins
                    ? () => setRole(collaborator.userId, "admin")
                    : undefined
                }
                toggleRoleTitle={t("projects.roles.makeAdmin")}
                removeLabel={t("projects.removeMember.removeButton", {
                  name:
                    collaborator.userName || collaborator.userEmail || "",
                })}
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

      <DestructiveDialog
        open={pendingRemoval !== null}
        title={t("projects.removeMember.title")}
        message={t("projects.removeMember.message", {
          name: pendingRemoval?.name ?? "",
        })}
        confirmLabel={t("projects.removeMember.confirm")}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </Card>
  )
}
