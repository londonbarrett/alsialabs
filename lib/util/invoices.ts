import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import type { Invoice, InvoiceStatus } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"

export function computeLineTotal(
  qty: number,
  price: number,
  discountPct: number,
  taxPct: number
): {
  total: number
  discountAmount: number
  taxAmount: number
} {
  const lineSubtotal = qty * price
  const discountAmount = lineSubtotal * (discountPct / 100)
  const taxable = lineSubtotal - discountAmount
  const taxAmount = taxable * (taxPct / 100)
  const total = taxable + taxAmount
  return { total, discountAmount, taxAmount }
}

export interface InvoiceLineTotalsInput {
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
}

export function computeInvoiceTotals(items: InvoiceLineTotalsInput[]) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0
  let grandTotal = 0

  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const discPct = parseFloat(item.discountPercent) || 0
    const taxPct = parseFloat(item.taxPercent) || 0

    const lineSubtotal = qty * price
    const discountAmount = lineSubtotal * (discPct / 100)
    const taxable = lineSubtotal - discountAmount
    const taxAmount = taxable * (taxPct / 100)

    subtotal += lineSubtotal
    discountTotal += discountAmount
    taxTotal += taxAmount
    grandTotal += taxable + taxAmount
  }

  return {
    subtotal: subtotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
  }
}

export function buildOptimisticInvoice(
  data: InvoiceFormData,
  invoiceId: string | undefined,
  editingInvoice: Invoice | undefined,
  invoices: InvoiceWithClientName[]
): InvoiceWithClientName {
  const isEdit = !!invoiceId
  const tempId = `temp-${Date.now()}`
  const totals = computeInvoiceTotals(data.items)
  const paid = Math.max(0, parseFloat(data.paidAmount || "0") || 0)
  const grandTotalNum = parseFloat(totals.grandTotal) || 0
  const derivedStatus: InvoiceStatus =
    !isEdit && paid >= grandTotalNum
      ? "paid"
      : !isEdit && paid > 0
        ? "partially_paid"
        : isEdit
          ? (editingInvoice?.status as InvoiceStatus) ?? "draft"
          : "draft"

  const clientName =
    (isEdit
      ? invoices.find((inv) => inv.id === invoiceId)?.clientName
      : invoices.find((inv) => inv.clientId === data.clientId)
          ?.clientName) ?? null

  return {
    id: isEdit ? invoiceId! : tempId,
    store_id:
      (editingInvoice as unknown as { store_id?: string | null })
        ?.store_id ?? null,
    type: data.type,
    invoiceNumber: isEdit
      ? (editingInvoice?.invoiceNumber ?? "…")
      : "…",
    clientId: data.clientId,
    userId: null,
    status: derivedStatus,
    issueDate: data.issueDate,
    dueDate: data.dueDate || null,
    paidAmount: isEdit
      ? (editingInvoice?.paidAmount ?? "0")
      : paid.toFixed(2),
    notes: data.notes || null,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    projectId: null,
    createdAt: editingInvoice?.createdAt ?? new Date(),
    updatedAt: new Date(),
    clientName,
  } as InvoiceWithClientName
}
