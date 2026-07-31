"use client"

import { ActivityItem } from "@/components/clients/activity-item"
import { InvoiceItem } from "@/components/clients/invoice-item"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { PaymentItem } from "@/components/clients/payment-item"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { ReminderItem } from "@/components/clients/reminder-item"
import { Dialog } from "@/components/common/dialog"
import { EditPaymentForm } from "@/components/sales/edit-payment-form"
import { InvoiceForm } from "@/components/sales/invoice-form"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { deleteActivity } from "@/lib/actions/activities"
import {
  completeReminder,
  deleteReminder,
} from "@/lib/actions/reminders"
import { deleteInvoice, deletePayment } from "@/lib/actions/sales"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type TimelineEntry =
  | ({ kind: "activity" } & ClientActivity)
  | ({ kind: "reminder" } & ClientReminder)
  | ({ kind: "invoice" } & Invoice)
  | ({ kind: "payment" } & InvoicePayment & { invoiceNumber: string })

interface ActivityTimelineProps {
  clientId: string
  activities: ClientActivity[]
  reminders: ClientReminder[]
  invoices: Invoice[]
  payments?: Array<InvoicePayment & { invoiceNumber: string }>
  permissions: string[]
}

function getEntryDate(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "activity":
      return (entry as ClientActivity).activityDate
    case "reminder":
      return (entry as ClientReminder).remindAt
    case "invoice":
      return (entry as Invoice).issueDate
    case "payment":
      return (entry as InvoicePayment & { invoiceNumber: string })
        .paymentDate
  }
}

export function ActivityTimeline({
  clientId,
  activities,
  reminders,
  invoices,
  payments = [],
  permissions,
}: ActivityTimelineProps) {
  const router = useRouter()
  const t = useTranslations()
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<
    ClientActivity | undefined
  >()
  const [editingReminder, setEditingReminder] = useState<
    ClientReminder | undefined
  >()
  const [editingInvoice, setEditingInvoice] = useState<
    Invoice | undefined
  >()
  const [editingPayment, setEditingPayment] = useState<
    InvoicePayment | undefined
  >()
  const [activityFormKey, setActivityFormKey] = useState(0)
  const [reminderFormKey, setReminderFormKey] = useState(0)
  const [invoiceFormKey, setInvoiceFormKey] = useState(0)

  const entries: TimelineEntry[] = [
    ...activities.map((a) => ({ ...a, kind: "activity" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
    ...invoices.map((i) => ({ ...i, kind: "invoice" as const })),
    ...payments.map((p) => ({ ...p, kind: "payment" as const })),
  ].sort((a, b) => {
    const dateA = getEntryDate(a)
    const dateB = getEntryDate(b)
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  function handleSuccess() {
    router.refresh()
  }

  async function handleDeleteActivity(activity: ClientActivity) {
    const result = await deleteActivity(activity.id)
    if (!result.success)
      toast.error(result.error || t("activities.failedToDelete"))
    else {
      toast.success(t("activities.activityDeleted"))
      router.refresh()
    }
  }

  async function handleDeleteReminder(reminder: ClientReminder) {
    const result = await deleteReminder(reminder.id)
    if (!result.success)
      toast.error(result.error || t("reminders.failedToDelete"))
    else {
      toast.success(t("reminders.reminderDeleted"))
      router.refresh()
    }
  }

  async function handleCompleteReminder(reminder: ClientReminder) {
    const result = await completeReminder(reminder.id)
    if (!result.success)
      toast.error(result.error || t("reminders.failedToComplete"))
    else {
      toast.success(t("reminders.reminderCompleted"))
      router.refresh()
    }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    const result = await deleteInvoice(invoice.id)
    if (!result.success)
      toast.error(result.error || t("sales.failedToDelete"))
    else {
      toast.success(t("sales.invoiceDeleted"))
      router.refresh()
    }
  }

  async function handleDeletePayment(payment: InvoicePayment) {
    const result = await deletePayment(payment.id)
    if (!result.success)
      toast.error(result.error || t("common.somethingWentWrong"))
    else {
      toast.success(t("sales.paymentDeleted"))
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
  const canEditPayment = permissions.includes("sales:record-payment")
  const canDeletePayment = permissions.includes("sales:record-payment")

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("activities.title")}
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
              <Plus /> {t("activities.logActivityBtn")}
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
              <Plus /> {t("activities.addReminder")}
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
              <Plus /> {t("activities.createInvoice")}
            </Button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>{t("activities.noActivities")}</p>
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
              ) : entry.kind === "invoice" ? (
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
              ) : (
                <PaymentItem
                  payment={entry}
                  invoiceNumber={entry.invoiceNumber}
                  onEdit={() => {
                    setEditingPayment(entry)
                    setPaymentDialogOpen(true)
                  }}
                  onDelete={() => handleDeletePayment(entry)}
                  canEdit={canEditPayment}
                  canDelete={canDeletePayment}
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

      <Dialog
        key={editingInvoice?.id ?? `new-invoice-${invoiceFormKey}`}
        title={
          editingInvoice
            ? t("sales.editInvoice")
            : t("sales.newInvoice")
        }
        description={
          editingInvoice
            ? t("sales.updateDetails")
            : t("sales.fillDetails")
        }
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open)
          if (!open) setEditingInvoice(undefined)
        }}
        className="sm:max-w-2xl"
      >
        <InvoiceForm
          invoice={editingInvoice}
          selectedClientId={clientId}
          onSuccess={() => {
            handleSuccess()
            setInvoiceDialogOpen(false)
            setEditingInvoice(undefined)
          }}
          onCancel={() => setInvoiceDialogOpen(false)}
        />
      </Dialog>

      <Dialog
        key={editingPayment?.id ?? "payment-dialog"}
        title={t("sales.editPayment")}
        description={t("sales.editPaymentDesc")}
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open)
          if (!open) setEditingPayment(undefined)
        }}
      >
        {editingPayment && (
          <EditPaymentForm
            payment={editingPayment}
            onSuccess={() => {
              handleSuccess()
              setPaymentDialogOpen(false)
              setEditingPayment(undefined)
            }}
            onCancel={() => setPaymentDialogOpen(false)}
          />
        )}
      </Dialog>
    </section>
  )
}
