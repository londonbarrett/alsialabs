"use server"

import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import {
  clientsTable,
  invoicePaymentsTable,
  invoicesTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, eq, sql } from "drizzle-orm"

export interface ClientInvoice {
  id: string
  type: string
  invoiceNumber: string
  clientId: string
  status: string
  issueDate: string
  notes: string | null
  subtotal: string
  discountTotal: string
  taxTotal: string
  grandTotal: string
  projectId: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getClientInvoices(
  clientId: string
): Promise<
  | { success: true; data: ClientInvoice[] }
  | { success: false; error: string }
> {
  const t = await getActionT("actions.activities")

  try {
    await requirePermission("client-activity", "view")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  const role = session.user.role

  if (role === "user") {
    const ownClient = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.userId, session.user.id),
          eq(clientsTable.id, clientId)
        )
      )
      .then((rows) => rows[0])

    if (!ownClient) return { success: false, error: t("forbidden") }
  }

  const invoices = await db
    .select({
      id: invoicesTable.id,
      type: invoicesTable.type,
      invoiceNumber: invoicesTable.invoiceNumber,
      clientId: invoicesTable.clientId,
      status: invoicesTable.status,
      issueDate: invoicesTable.issueDate,
      notes: invoicesTable.notes,
      subtotal: invoicesTable.subtotal,
      discountTotal: invoicesTable.discountTotal,
      taxTotal: invoicesTable.taxTotal,
      grandTotal: invoicesTable.grandTotal,
      projectId: invoicesTable.projectId,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.clientId, clientId))
    .orderBy(sql`${invoicesTable.issueDate} desc`)

  return { success: true, data: invoices }
}

export async function getClientPayments(clientId: string): Promise<
  | {
      success: true
      data: Array<InvoicePayment & { invoiceNumber: string }>
    }
  | { success: false; error: string }
> {
  const t = await getActionT("actions.activities")

  try {
    await requirePermission("client-activity", "view")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  const role = session.user.role

  if (role === "user") {
    const ownClient = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.userId, session.user.id),
          eq(clientsTable.id, clientId)
        )
      )
      .then((rows) => rows[0])

    if (!ownClient) return { success: false, error: t("forbidden") }
  }

  const payments = await db
    .select({
      id: invoicePaymentsTable.id,
      invoiceId: invoicePaymentsTable.invoiceId,
      amount: invoicePaymentsTable.amount,
      paymentDate: invoicePaymentsTable.paymentDate,
      method: invoicePaymentsTable.method,
      reference: invoicePaymentsTable.reference,
      notes: invoicePaymentsTable.notes,
      userId: invoicePaymentsTable.userId,
      createdAt: invoicePaymentsTable.createdAt,
      invoiceNumber: invoicesTable.invoiceNumber,
    })
    .from(invoicePaymentsTable)
    .innerJoin(
      invoicesTable,
      eq(invoicePaymentsTable.invoiceId, invoicesTable.id)
    )
    .where(eq(invoicesTable.clientId, clientId))
    .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`)

  return { success: true, data: payments }
}
