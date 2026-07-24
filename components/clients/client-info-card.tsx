"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Pencil } from "lucide-react"
import { ClientDialog } from "@/components/clients/client-dialog"
import type { Client } from "@/lib/drizzle/schema"

interface ClientInfoCardProps {
  client: Client
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const t = useTranslations()
  const [displayClient, setDisplayClient] = useState(client)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("common.details")}</CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDialogOpen(true)}
              aria-label={t("clients.editClient")}
            >
              <Pencil />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("common.name")}</p>
            <p className="text-base font-medium">{displayClient.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.phone")}
            </p>
            <p className="text-base font-medium">{displayClient.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.email")}
            </p>
            <p className="text-base font-medium">
              {displayClient.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.location")}
            </p>
            <p className="text-base font-medium">
              {displayClient.location ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.comments")}
            </p>
            <p className="text-base font-medium">
              {displayClient.comments ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>
      <ClientDialog
        client={displayClient}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(data) => {
          setDisplayClient((prev) => ({ ...prev, ...data }))
        }}
      />
    </>
  )
}
