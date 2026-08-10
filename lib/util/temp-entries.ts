import type { ActivityFormData } from "@/lib/actions/activities"
import type { InvoiceFormData } from "@/lib/actions/sales"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
} from "@/lib/drizzle/schema"
import { computeInvoiceTotals } from "@/lib/sales/totals"

export type TempActivityEntry = { kind: "activity" } & ClientActivity
export type TempReminderEntry = { kind: "reminder" } & ClientReminder
export type TempInvoiceEntry = { kind: "invoice" } & Invoice

export function buildTempActivity(
  data: ActivityFormData
): TempActivityEntry {
  return {
    kind: "activity",
    id: `temp-${Date.now()}`,
    store_id: null,
    clientId: data.clientId,
    type: data.type,
    subject: data.subject,
    description: data.description || null,
    activityDate: data.activityDate,
    performedBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function buildTempReminder(data: {
  clientId: string
  description: string
  remindAt: string
}): TempReminderEntry {
  return {
    kind: "reminder",
    id: `temp-${Date.now()}`,
    clientId: data.clientId,
    description: data.description,
    remindAt: data.remindAt,
    completed: false,
    completedAt: null,
    createdBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    store_id: null,
  }
}

export function buildTempInvoice(
  data: InvoiceFormData
): TempInvoiceEntry {
  const totals = computeInvoiceTotals(data.items)
  const paid = Math.max(0, parseFloat(data.paidAmount || "0") || 0)
  const grandTotalNum = parseFloat(totals.grandTotal) || 0
  const status: Invoice["status"] =
    paid >= grandTotalNum
      ? "paid"
      : paid > 0
        ? "partially_paid"
        : "draft"
  return {
    kind: "invoice",
    id: `temp-${Date.now()}`,
    store_id: null,
    type: data.type,
    invoiceNumber: "…",
    clientId: data.clientId,
    userId: null,
    status,
    issueDate: data.issueDate,
    dueDate: data.dueDate || null,
    paidAmount: paid.toFixed(2),
    notes: data.notes || null,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
