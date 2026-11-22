"use client"

import type { ProjectMemberRowDTO } from "@/actions/projects/schemas"
import { ActionConfirmDialog } from "@/components/common/action-confirm-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

function label(member: ProjectMemberRowDTO) {
  return member.userName || member.userEmail || member.userId
}

export function TaskAssigneeSelect({
  value,
  onChange,
  members,
  protectedIds,
  onRemoveDisposition,
}: {
  value: string[]
  onChange: (value: string[]) => void
  members: ProjectMemberRowDTO[]
  protectedIds: string[]
  onRemoveDisposition?: (
    userId: string,
    disposition: "done" | "cancelled"
  ) => void
}) {
  const t = useTranslations()
  const [pendingRemoveId, setPendingRemoveId] = useState<
    string | null
  >(null)

  const selected = members.filter((member) =>
    value.includes(member.userId)
  )

  function toggle(memberId: string) {
    const next = value.includes(memberId)
      ? value.filter((id) => id !== memberId)
      : [...value, memberId]
    // Rebuild in member-list order so chips and the payload stay stable
    // regardless of the order picks were made in.
    onChange(
      members
        .filter((member) => next.includes(member.userId))
        .map((member) => member.userId)
    )
  }

  // Removing a member who holds an open assignment on the server needs
  // the disposition dialog; one added this session goes straight out.
  function requestRemove(userId: string) {
    if (protectedIds.includes(userId)) {
      setPendingRemoveId(userId)
      return
    }
    onChange(value.filter((id) => id !== userId))
  }

  function confirmRemove(disposition: "done" | "cancelled") {
    if (!pendingRemoveId) return
    onChange(value.filter((id) => id !== pendingRemoveId))
    onRemoveDisposition?.(pendingRemoveId, disposition)
    setPendingRemoveId(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.map((member) => (
        <div
          key={member.userId}
          className="flex w-fit items-center gap-1.5 rounded-full border py-1 pr-1 pl-2"
        >
          <Avatar className="size-5">
            <AvatarImage src={member.userImage ?? undefined} alt="" />
            <AvatarFallback className="text-[8px]">
              {label(member).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{label(member)}</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t("actionMenu.deleteItem", {
              name: label(member),
            })}
            onClick={() => requestRemove(member.userId)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
            >
              {/* Decorative preview of who can be picked: aria-hidden so
                  the trigger's accessible name stays the label alone. */}
              <span aria-hidden="true" className="flex -space-x-2">
                {members.slice(0, 3).map((member) => (
                  <Avatar
                    key={member.userId}
                    size="sm"
                    className="border-2 border-background"
                  >
                    <AvatarImage
                      src={member.userImage ?? undefined}
                      alt=""
                    />
                    <AvatarFallback>
                      {label(member).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </span>
              {t("projects.tasks.addAssignee")}
              <ChevronDown className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent>
          {members.map((member) => (
            <DropdownMenuCheckboxItem
              key={member.userId}
              checked={value.includes(member.userId)}
              closeOnClick
              onCheckedChange={(next) =>
                next
                  ? toggle(member.userId)
                  : requestRemove(member.userId)
              }
            >
              <span className="flex flex-col">
                <span className="text-sm">{label(member)}</span>
                {member.userName && member.userEmail && (
                  <span className="text-xs text-muted-foreground">
                    {member.userEmail}
                  </span>
                )}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ActionConfirmDialog
        open={pendingRemoveId !== null}
        title={t("projects.tasks.unassign.title")}
        message={t("projects.tasks.unassign.message")}
        actions={[
          {
            label: t("projects.tasks.unassign.markDone"),
            onClick: () => confirmRemove("done"),
            variant: "default",
          },
          {
            label: t("projects.tasks.unassign.markCancelled"),
            onClick: () => confirmRemove("cancelled"),
            variant: "default",
          },
        ]}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  )
}
