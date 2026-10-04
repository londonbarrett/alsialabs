"use client"

import type { PaymentFormValues } from "@/components/sales/payment-form"
import type { ActivityFormData } from "@/lib/actions/activities"
import {
  deleteActivity as deleteActivityAction,
  upsertActivity,
} from "@/lib/actions/activities"
import {
  createInvoice as createInvoiceAction,
  updateInvoice as updateInvoiceAction,
} from "@/lib/actions/invoices"
import {
  deletePayment as deletePaymentAction,
  updatePayment as updatePaymentAction,
} from "@/lib/actions/payments"
import {
  completeReminder as completeReminderAction,
  deleteReminder as deleteReminderAction,
  upsertReminder,
} from "@/lib/actions/reminders"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import type { ReminderSubmitData, SettleResult } from "@/lib/types"
import { computeInvoiceTotals } from "@/lib/util/invoices"
import {
  buildTempActivity,
  buildTempInvoice,
  buildTempReminder,
} from "@/lib/util/temp-entries"
import { useTimelineStore } from "@/stores/timeline-store"
import { type TimelineEntryAction } from "@/stores/timeline-reducer"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useSettle } from "@/hooks/use-settle"
import { useTranslations } from "next-intl"

/**
 * Mutations for the client detail page, where the timeline is the list on
 * screen. Requires TimelineProvider.
 *
 * The activity page has its own handler, `useActivityActions`
 * `stores/use-activity-actions.ts`, because exactly one store is live per route.
 */
export function useTimelineActions() {
  const t = useTranslations()
  const settle = useSettle()
  const { run } = useOptimisticAction(useTimelineStore())

  async function createInvoice(
    data: InvoiceFormData
  ): Promise<SettleResult> {
    const entry = buildTempInvoice(data)
    const result = await run(
      { type: "add", entry },
      () => createInvoiceAction(data),
      {
        commitAction: (res): TimelineEntryAction => ({
          type: "patch",
          kind: "invoice",
          id: entry.id,
          patch: ((res as { data?: unknown }).data ??
            {}) as Partial<Invoice>,
        }),
      }
    )
    return settle(result, t("sales.invoiceCreated"))
  }

  async function updateInvoice(
    data: InvoiceFormData,
    invoiceId: string
  ): Promise<SettleResult> {
    const totals = computeInvoiceTotals(data.items)
    const result = await run(
      {
        type: "patch",
        kind: "invoice",
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
      },
      () => updateInvoiceAction({ ...data, invoiceId })
    )
    return settle(result, t("sales.invoiceUpdated"))
  }

  async function createReminder(
    data: ReminderSubmitData
  ): Promise<void> {
    const entry = buildTempReminder(data)
    const result = await run(
      { type: "add", entry },
      () => upsertReminder(data),
      {
        commitAction: (r): TimelineEntryAction => ({
          type: "patch",
          kind: "reminder",
          id: entry.id,
          patch: r.reminder ?? {},
        }),
      }
    )
    settle(result, t("reminders.reminderCreated"))
  }

  async function updateReminder(
    data: ReminderSubmitData,
    editingId: string
  ): Promise<void> {
    const result = await run(
      {
        type: "patch",
        kind: "reminder",
        id: editingId,
        patch: {
          description: data.description,
          remindAt: data.remindAt,
        },
      },
      () => upsertReminder(data, editingId)
    )
    settle(result, t("reminders.reminderUpdated"))
  }

  async function createActivity(
    data: ActivityFormData
  ): Promise<void> {
    const entry = buildTempActivity(data)
    const result = await run(
      { type: "add", entry },
      // TODO: migrate to safe actions
      () => upsertActivity(data),
      {
        commitAction: (r): TimelineEntryAction => ({
          type: "patch",
          kind: "activity",
          id: entry.id,
          patch: r.success ? r.activity : {},
        }),
      }
    )
    settle(result, t("activities.activityLogged"))
  }

  async function updateActivity(
    data: ActivityFormData,
    editingId: string
  ): Promise<void> {
    const result = await run(
      {
        type: "patch",
        kind: "activity",
        id: editingId,
        patch: {
          subject: data.subject,
          description: data.description || null,
          type: data.type,
          activityDate: data.activityDate,
        },
      },
      () => upsertActivity(data, editingId)
    )
    settle(result, t("activities.activityUpdated"))
  }

  async function completeReminder(reminderId: string) {
    const result = await run(
      {
        type: "patch",
        kind: "reminder",
        id: reminderId,
        patch: { completed: true, completedAt: new Date() },
      },
      () => completeReminderAction(reminderId)
    )
    settle(
      result,
      t("reminders.reminderCompleted"),
      t("reminders.failedToComplete")
    )
  }

  async function deleteReminder(reminderId: string) {
    const result = await run({ type: "delete", id: reminderId }, () =>
      deleteReminderAction(reminderId)
    )
    settle(
      result,
      t("reminders.reminderDeleted"),
      t("reminders.failedToDelete")
    )
  }

  async function deleteActivity(activityId: string) {
    const result = await run({ type: "delete", id: activityId }, () =>
      deleteActivityAction(activityId)
    )
    settle(
      result,
      t("activities.activityDeleted"),
      t("activities.failedToDelete")
    )
  }

  async function updatePayment(
    paymentId: string,
    values: PaymentFormValues
  ) {
    const patch = {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method || null,
      reference: values.reference || null,
      notes: values.notes || null,
    }
    const result = await run(
      { type: "patch", kind: "payment", id: paymentId, patch },
      () => updatePaymentAction({ paymentId, ...values })
    )
    settle(result, t("sales.paymentUpdated"))
  }

  async function deletePayment(paymentId: string) {
    const result = await run({ type: "delete", id: paymentId }, () =>
      deletePaymentAction({ paymentId })
    )
    settle(result, t("sales.paymentDeleted"))
  }

  return {
    createInvoice,
    updateInvoice,
    createReminder,
    updateReminder,
    createActivity,
    updateActivity,
    completeReminder,
    deleteReminder,
    deleteActivity,
    updatePayment,
    deletePayment,
  }
}
