"use client"

import { ActivityItem } from "@/components/clients/activity-item"
import { InvoiceItem } from "@/components/clients/invoice-item"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { PaymentItem } from "@/components/clients/payment-item"
import type { ReminderSubmitResult } from "@/components/clients/reminder-dialog"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { ReminderItem } from "@/components/clients/reminder-item"
import { EditPaymentDialog } from "@/components/sales/edit-payment-dialog"
import { InvoiceDialog } from "@/components/sales/invoice-dialog"
import type { InvoiceSubmitResult } from "@/components/sales/invoice-form"
import type {
  PaymentFormValues,
  PaymentSubmitResult,
} from "@/components/sales/payment-form"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus"
import type {
  ActivityFormData,
  UpsertActivityResult,
} from "@/lib/actions/activities"
import {
  deleteActivity,
  upsertActivity,
} from "@/lib/actions/activities"
import {
  completeReminder,
  deleteReminder,
  upsertReminder,
} from "@/lib/actions/reminders"
import {
  createInvoice,
  deleteInvoice,
  updateInvoice,
} from "@/lib/actions/invoices"
import { deletePayment, updatePayment } from "@/lib/actions/payments"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import { computeInvoiceTotals } from "@/lib/util/invoices"
import { useActionError } from "@/lib/util/action-errors"
import {
  buildTempActivity,
  buildTempInvoice,
  buildTempReminder,
} from "@/lib/util/temp-entries"
import {
  sortTimelineEntries,
  timelineReducer,
  type TimelineEntry,
  type TimelineEntryAction,
} from "@/reducers/timeline-reducer"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

interface ActivityTimelineProps {
  clientId: string
  activities: ClientActivity[]
  reminders: ClientReminder[]
  invoices: Invoice[]
  payments?: Array<InvoicePayment & { invoiceNumber: string }>
  permissions: string[]
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
  const translateError = useActionError()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  useRefreshOnFocus()
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
  ]

  const [optimisticEntries, addOptimistic] = useOptimistic(
    sortTimelineEntries(entries),
    timelineReducer
  )
  const [, startTransition] = useTransition()

  async function runOptimistic<Result>(
    action: TimelineEntryAction,
    serverFn: () => Promise<Result>
  ): Promise<Result> {
    startLoading()
    try {
      return await new Promise<Result>((resolve, reject) => {
        startTransition(async () => {
          addOptimistic(action)
          try {
            const result = await serverFn()
            router.refresh()
            resolve(result)
          } catch (error) {
            reject(error)
          }
        })
      })
    } finally {
      stopLoading()
    }
  }

  async function handleActivitySubmit(
    data: ActivityFormData,
    activityId?: string
  ): Promise<UpsertActivityResult> {
    setLogDialogOpen(false)
    setEditingActivity(undefined)
    const action: TimelineEntryAction = activityId
      ? {
          type: "patch",
          kind: "activity",
          id: activityId,
          patch: {
            subject: data.subject,
            description: data.description || null,
            type: data.type,
            activityDate: data.activityDate,
          },
        }
      : { type: "add", entry: buildTempActivity(data) }
    const result = await runOptimistic(action, () =>
      upsertActivity(data, activityId)
    )
    if (result.success) {
      toast.success(
        activityId
          ? t("activities.activityUpdated")
          : t("activities.activityLogged")
      )
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result
  }

  async function handleReminderSubmit(
    data: { clientId: string; description: string; remindAt: string },
    reminderId?: string
  ): Promise<ReminderSubmitResult> {
    setReminderDialogOpen(false)
    setEditingReminder(undefined)
    const action: TimelineEntryAction = reminderId
      ? {
          type: "patch",
          kind: "reminder",
          id: reminderId,
          patch: {
            description: data.description,
            remindAt: data.remindAt,
          },
        }
      : { type: "add", entry: buildTempReminder(data) }
    const result = await runOptimistic(action, () =>
      upsertReminder(data, reminderId)
    )
    if (result.success) {
      toast.success(
        reminderId
          ? t("reminders.reminderUpdated")
          : t("reminders.reminderCreated")
      )
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result
  }

  async function handleInvoiceSubmit(
    data: InvoiceFormData,
    invoiceId?: string
  ): Promise<InvoiceSubmitResult> {
    setInvoiceDialogOpen(false)
    setEditingInvoice(undefined)
    const action: TimelineEntryAction = invoiceId
      ? (() => {
          const totals = computeInvoiceTotals(data.items)
          return {
            type: "patch" as const,
            kind: "invoice" as const,
            id: invoiceId,
            patch: {
              type: data.type,
              clientId: data.clientId,
              issueDate: data.issueDate,
              dueDate: data.dueDate || null,
              notes: data.notes || null,
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              taxTotal: totals.taxTotal,
              grandTotal: totals.grandTotal,
            },
          }
        })()
      : { type: "add", entry: buildTempInvoice(data) }

    const optimisticResult = await runOptimistic(action, () =>
      invoiceId
        ? updateInvoice({ ...data, invoiceId })
        : createInvoice(data)
    )

    const result: InvoiceSubmitResult = optimisticResult.data
      ? { success: true as const }
      : optimisticResult.serverError
        ? {
            success: false as const,
            error: translateError(optimisticResult.serverError.code),
          }
        : optimisticResult.validationErrors
          ? {
              success: false as const,
              error: t("common.somethingWentWrong"),
              fieldErrors: optimisticResult.validationErrors as Record<
                string,
                string[] | undefined
              >,
            }
          : {
              success: false as const,
              error: t("common.somethingWentWrong"),
            }

    if (result.success) {
      toast.success(
        invoiceId
          ? t("sales.invoiceUpdated")
          : t("sales.invoiceCreated")
      )
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result
  }

  async function handleUpdatePayment(
    values: PaymentFormValues
  ): Promise<PaymentSubmitResult> {
    if (!editingPayment)
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
      }
    const payment = editingPayment
    setPaymentDialogOpen(false)
    setEditingPayment(undefined)
    const optimisticResult = await runOptimistic(
      {
        type: "patch",
        kind: "payment",
        id: payment.id,
        patch: {
          amount: values.amount,
          paymentDate: values.paymentDate,
          method: values.method || null,
          reference: values.reference || null,
          notes: values.notes || null,
        },
      },
      () => updatePayment({ paymentId: payment.id, ...values })
    )

    const result: PaymentSubmitResult = optimisticResult.data
      ? { success: true as const }
      : optimisticResult.serverError
        ? {
            success: false as const,
            error: translateError(optimisticResult.serverError.code),
          }
        : optimisticResult.validationErrors
          ? {
              success: false as const,
              error: t("common.somethingWentWrong"),
              fieldErrors: optimisticResult.validationErrors as Record<
                string,
                string[] | undefined
              >,
            }
          : {
              success: false as const,
              error: t("common.somethingWentWrong"),
            }

    if (result.success) {
      toast.success(t("sales.paymentUpdated"))
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result
  }

  async function handleDeleteActivity(activity: ClientActivity) {
    const result = await runOptimistic(
      { type: "remove", kind: "activity", id: activity.id },
      () => deleteActivity(activity.id)
    )
    if (!result.success)
      toast.error(result.error || t("activities.failedToDelete"))
    else toast.success(t("activities.activityDeleted"))
  }

  async function handleDeleteReminder(reminder: ClientReminder) {
    const result = await runOptimistic(
      { type: "remove", kind: "reminder", id: reminder.id },
      () => deleteReminder(reminder.id)
    )
    if (!result.success)
      toast.error(result.error || t("reminders.failedToDelete"))
    else toast.success(t("reminders.reminderDeleted"))
  }

  async function handleCompleteReminder(reminder: ClientReminder) {
    const result = await runOptimistic(
      {
        type: "patch",
        kind: "reminder",
        id: reminder.id,
        patch: { completed: true, completedAt: new Date() },
      },
      () => completeReminder(reminder.id)
    )
    if (!result.success)
      toast.error(result.error || t("reminders.failedToComplete"))
    else toast.success(t("reminders.reminderCompleted"))
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    const result = await runOptimistic(
      { type: "remove", kind: "invoice", id: invoice.id },
      () => deleteInvoice({ invoiceId: invoice.id })
    )
    if (result.serverError)
      toast.error(translateError(result.serverError.code))
    else if (result.data) toast.success(t("sales.invoiceDeleted"))
    else toast.error(t("sales.failedToDelete"))
  }

  async function handleDeletePayment(payment: InvoicePayment) {
    const result = await runOptimistic(
      { type: "remove", kind: "payment", id: payment.id },
      () => deletePayment({ paymentId: payment.id })
    )
    if (result.serverError)
      toast.error(translateError(result.serverError.code))
    else if (result.data) toast.success(t("sales.paymentDeleted"))
    else toast.error(t("common.somethingWentWrong"))
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("activities.title")}
        </h2>
        <div className="flex gap-2">
          {permissions.includes("client-activity:create") && (
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
          {permissions.includes("client-activity:create") && (
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
          {permissions.includes("sales:create") && (
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

      {optimisticEntries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>{t("activities.noActivities")}</p>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          {optimisticEntries.map((entry, idx) => (
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
                  canEdit={permissions.includes("client-activity:edit")}
                  canDelete={permissions.includes(
                    "client-activity:delete"
                  )}
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
                  canEdit={permissions.includes("client-activity:edit")}
                  canDelete={permissions.includes(
                    "client-activity:delete"
                  )}
                  canComplete={permissions.includes(
                    "client-activity:edit"
                  )}
                />
              ) : entry.kind === "invoice" ? (
                <InvoiceItem
                  invoice={entry}
                  onEdit={() => {
                    setEditingInvoice(entry)
                    setInvoiceDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteInvoice(entry)}
                  canEdit={permissions.includes("sales:edit")}
                  canDelete={permissions.includes("sales:delete")}
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
                  canEdit={permissions.includes("sales:edit")}
                  canDelete={permissions.includes("sales:delete")}
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
        onSubmit={handleActivitySubmit}
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
        onSubmit={handleReminderSubmit}
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
        onSubmit={handleInvoiceSubmit}
      />

      {editingPayment && (
        <EditPaymentDialog
          payment={editingPayment}
          open={paymentDialogOpen}
          onOpenChange={(open) => {
            setPaymentDialogOpen(open)
            if (!open) setEditingPayment(undefined)
          }}
          onSubmit={handleUpdatePayment}
        />
      )}
    </section>
  )
}
