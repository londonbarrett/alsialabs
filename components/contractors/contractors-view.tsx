"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Wrench } from "lucide-react"
import { useTranslations } from "next-intl"

interface Contractor {
  id: string
  userId: string
  bio: string | null
  hourlyRate: string | null
  portfolioLinks: string | null
  createdAt: Date
  updatedAt: Date
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface ContractorsViewProps {
  contractors: Contractor[]
  permissions?: string[]
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ContractorsView({
  contractors,
  permissions = [],
}: ContractorsViewProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">
          {t("sidebar.auxiliary")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          {t("contractors.title")}
        </h1>
        <p className="max-w-prose text-pretty text-muted-foreground">
          {t("contractors.subtitle")}
        </p>
      </header>

      {contractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Wrench className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {t("contractors.noContractors")}
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("common.name")}</TableHead>
                <TableHead scope="col">{t("common.email")}</TableHead>
                <TableHead scope="col">
                  {t("contractors.bio")}
                </TableHead>
                <TableHead scope="col">
                  {t("contractors.hourlyRate")}
                </TableHead>
                <TableHead scope="col">
                  {t("contractors.portfolioLinks")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractors.map((contractor) => (
                <TableRow key={contractor.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage
                          src={contractor.userImage ?? undefined}
                        />
                        <AvatarFallback className="text-xs">
                          {initials(contractor.userName ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {contractor.userName || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contractor.userEmail || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {contractor.bio || "—"}
                  </TableCell>
                  <TableCell>
                    {contractor.hourlyRate ? (
                      <Badge variant="default">
                        ${contractor.hourlyRate}{" "}
                        {t("contractors.perHour")}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {contractor.portfolioLinks || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
