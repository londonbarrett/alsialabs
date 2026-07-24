"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { ClientDialog } from "@/components/clients/client-dialog"
import type { Client } from "@/lib/drizzle/schema"

interface ClientInfoCardProps {
  client: Client
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const t = useTranslations()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="max-w-lg rounded-md border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("common.details")}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDialogOpen(true)}
            aria-label={t("clients.editClient")}
          >
            <Pencil />
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("common.name")}</p>
            <p className="text-base font-medium">{client.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.phone")}
            </p>
            <p className="text-base font-medium">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.email")}
            </p>
            <p className="text-base font-medium">{client.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.location")}
            </p>
            <p className="text-base font-medium">{client.location ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("clients.comments")}
            </p>
            <p className="text-base font-medium">{client.comments ?? "—"}</p>
          </div>
        </div>
      </div>
      <ClientDialog
        client={client}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          router.refresh()
          setDialogOpen(false)
        }}
      />
    </>
  )
}
