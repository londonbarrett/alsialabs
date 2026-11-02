"use client"

import type { ProjectMemberRowDTO } from "@/actions/schemas/project-membership"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "next-intl"

function label(member: ProjectMemberRowDTO) {
  return member.userName || member.userEmail || member.userId
}

export function TaskAssigneeSelect({
  value,
  onChange,
  members,
}: {
  value: string
  onChange: (value: string) => void
  members: ProjectMemberRowDTO[]
}) {
  const t = useTranslations()

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next ?? "")}
      items={[
        { value: "", label: t("common.unassigned") },
        ...members.map((m) => ({ value: m.userId, label: label(m) })),
      ]}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("common.unassigned")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{t("common.unassigned")}</SelectItem>
        {members.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            <span className="flex items-center gap-2">
              <Avatar className="size-5">
                <AvatarImage src={member.userImage ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {label(member).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex flex-col">
                <span className="text-sm">{label(member)}</span>
                {member.userName && member.userEmail && (
                  <span className="text-xs text-muted-foreground">
                    {member.userEmail}
                  </span>
                )}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
