"use client"

import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { Button } from "@/components/ui/button"
import { useHasPermission } from "@/stores/permissions-store"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function LogActivityButton({ clientId }: { clientId: string }) {
  const t = useTranslations()
  const canCreate = useHasPermission("client-activity:create")
  const [open, setOpen] = useState(false)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> {t("activities.logActivityBtn")}
      </Button>
      <LogActivityDialog
        clientId={clientId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
