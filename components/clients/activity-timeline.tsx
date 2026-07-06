"use client"

import { ActivityItem } from "@/components/clients/activity-item"
import { InvoiceItem } from "@/components/clients/invoice-item"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { ReminderItem } from "@/components/clients/reminder-item"
import { InvoiceDialog } from "@/components/sales/invoice-dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { deleteActivity } from "@/lib/actions/activities"
import {
  completeReminder,
  deleteReminder,
} from "@/lib/actions/reminders"
import { deleteInvoice } from "@/lib/actions/sales"
import type { Activity, Invoice, Reminder } from "@/lib/drizzle/schema"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type TimelineEntry =
  | ({ kind: "activity" } & Activity)
  | ({ kind: "reminder" } & Reminder)
  | ({ kind: "invoice" } & Invoice)

interface ActivityTimelineProps {
  clientId: string
  activities: Activity[]
  reminders: Reminder[]
  invoices: Invoice[]
  permissions: string[]
}

function getEntryDate(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "activity":
      return (entry as Activity).activityDate
    case "reminder":
      return (entry as Reminder).remindAt
    case "invoice":
      return (entry as Invoice).issueDate
  }
}

export function ActivityTimeline({
  clientId,
  activities,
  reminders,
  invoices,
  permissions,
}: ActivityTimelineProps) {
  const router = useRouter()
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<
    Activity | undefined
  >()
  const [editingReminder, setEditingReminder] = useState<
    Reminder | undefined
  >()
  const [editingInvoice, setEditingInvoice] = useState<
    Invoice | undefined
  >()
  const [activityFormKey, setActivityFormKey] = useState(0)
  const [reminderFormKey, setReminderFormKey] = useState(0)
  const [invoiceFormKey, setInvoiceFormKey] = useState(0)

  const entries: TimelineEntry[] = [
    ...activities.map((a) => ({ ...a, kind: "activity" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
    ...invoices.map((i) => ({ ...i, kind: "invoice" as const })),
  ].sort((a, b) => {
    const dateA = getEntryDate(a)
    const dateB = getEntryDate(b)
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  function handleSuccess() {
    router.refresh()
  }

  async function handleDeleteActivity(activity: Activity) {
    const result = await deleteActivity(activity.id)
    if (!result.success)
      toast.error(result.error || "Failed to delete activity")
    else {
      toast.success("Activity deleted")
      router.refresh()
    }
  }

  async function handleDeleteReminder(reminder: Reminder) {
    const result = await deleteReminder(reminder.id)
    if (!result.success)
      toast.error(result.error || "Failed to delete reminder")
    else {
      toast.success("Reminder deleted")
      router.refresh()
    }
  }

  async function handleCompleteReminder(reminder: Reminder) {
    const result = await completeReminder(reminder.id)
    if (!result.success)
      toast.error(result.error || "Failed to complete reminder")
    else {
      toast.success("Reminder completed")
      router.refresh()
    }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    const result = await deleteInvoice(invoice.id)
    if (!result.success)
      toast.error(result.error || "Failed to delete invoice")
    else {
      toast.success("Invoice deleted")
      router.refresh()
    }
  }

  const canCreateActivity = permissions.includes(
    "client-activity:create"
  )
  const canEditActivity = permissions.includes("client-activity:edit")
  const canDeleteActivity = permissions.includes(
    "client-activity:delete"
  )
  const canCreateReminder = permissions.includes(
    "client-activity:create"
  )
  const canEditReminder = permissions.includes("client-activity:edit")
  const canDeleteReminder = permissions.includes(
    "client-activity:delete"
  )
  const canCompleteReminder = permissions.includes(
    "client-activity:edit"
  )
  const canCreateInvoice = permissions.includes("sales:create")
  const canEditInvoice = permissions.includes("sales:edit")
  const canDeleteInvoice = permissions.includes("sales:delete")

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          Activity
        </h2>
        <div className="flex gap-2">
          {canCreateActivity && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingActivity(undefined)
                setLogDialogOpen(true)
                setActivityFormKey((k) => k + 1)
              }}
            >
              <Plus /> Log Activity
            </Button>
          )}
          {canCreateReminder && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingReminder(undefined)
                setReminderDialogOpen(true)
                setReminderFormKey((k) => k + 1)
              }}
            >
              <Plus /> Add Reminder
            </Button>
          )}
          {canCreateInvoice && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingInvoice(undefined)
                setInvoiceDialogOpen(true)
                setInvoiceFormKey((k) => k + 1)
              }}
            >
              <Plus /> Create Invoice
            </Button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>No activities yet.</p>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          {entries.map((entry, idx) => (
            <div key={`${entry.kind}-${entry.id}`}>
              {idx > 0 && <Separator />}
              {entry.kind === "activity" ? (
                <ActivityItem
                  activity={entry}
                  onEdit={() => {
                    setEditingActivity(entry)
                    setLogDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteActivity(entry)}
                  canEdit={canEditActivity}
                  canDelete={canDeleteActivity}
                />
              ) : entry.kind === "reminder" ? (
                <ReminderItem
                  reminder={entry}
                  onEdit={() => {
                    setEditingReminder(entry)
                    setReminderDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteReminder(entry)}
                  onComplete={() => handleCompleteReminder(entry)}
                  canEdit={canEditReminder}
                  canDelete={canDeleteReminder}
                  canComplete={canCompleteReminder}
                />
              ) : (
                <InvoiceItem
                  invoice={entry}
                  onEdit={() => {
                    setEditingInvoice(entry)
                    setInvoiceDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteInvoice(entry)}
                  canEdit={canEditInvoice}
                  canDelete={canDeleteInvoice}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <LogActivityDialog
        key={editingActivity?.id ?? `new-activity-${activityFormKey}`}
        clientId={clientId}
        activity={editingActivity}
        open={logDialogOpen}
        onOpenChange={(open) => {
          setLogDialogOpen(open)
          if (!open) setEditingActivity(undefined)
        }}
        onSuccess={handleSuccess}
      />

      <ReminderDialog
        key={editingReminder?.id ?? `new-reminder-${reminderFormKey}`}
        clientId={clientId}
        reminder={editingReminder}
        open={reminderDialogOpen}
        onOpenChange={(open) => {
          setReminderDialogOpen(open)
          if (!open) setEditingReminder(undefined)
        }}
        onSuccess={handleSuccess}
      />

      <InvoiceDialog
        key={editingInvoice?.id ?? `new-invoice-${invoiceFormKey}`}
        invoice={editingInvoice}
        selectedClientId={clientId}
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open)
          if (!open) setEditingInvoice(undefined)
        }}
        onSuccess={handleSuccess}
      />
    </section>
  )
}
