"use client"

import { useTimelineActions } from "@/stores/use-timeline-actions"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { Button } from "@/components/ui/button"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function AddReminderButton({ clientId }: { clientId: string }) {
  const { createReminder, updateReminder } = useTimelineActions()
  const t = useTranslations()
  const canCreate = useHasPermission("client-activity:create")
  const [open, setOpen] = useState(false)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> {t("activities.addReminder")}
      </Button>
      <ReminderDialog
        clientId={clientId}
        open={open}
        onOpenChange={setOpen}
        onSubmit={(data, editingId) =>
          editingId
            ? updateReminder(data, editingId)
            : createReminder(data)
        }
      />
    </>
  )
}
