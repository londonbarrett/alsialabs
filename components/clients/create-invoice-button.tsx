"use client"

import { TimelineInvoiceDialog } from "@/components/clients/timeline-invoice-dialog"
import { Button } from "@/components/ui/button"
import { useHasPermission } from "@/stores/permissions-store"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function CreateInvoiceButton({
  clientId,
}: {
  clientId: string
}) {
  const t = useTranslations()
  const canCreate = useHasPermission("sales:create")
  const [open, setOpen] = useState(false)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> {t("activities.createInvoice")}
      </Button>
      <TimelineInvoiceDialog
        clientId={clientId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
