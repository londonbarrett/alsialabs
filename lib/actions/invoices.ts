"use server"

import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import type {
  Invoice,
  InvoiceItem,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import {
  clientsTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/util/i18n-actions"
import { and, eq, inArray, or, sql } from "drizzle-orm"

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

export type MyInvoice = Invoice & { outstandingBalance: string }

function deriveOverdueStatus<
  T extends {
    status: string
    dueDate: string | null
    paidAmount: string
    grandTotal: string
  },
>(inv: T, today: string): T {
  let derivedStatus = inv.status
  if (
    derivedStatus !== "paid" &&
    derivedStatus !== "cancelled" &&
    derivedStatus !== "draft" &&
    inv.dueDate &&
    inv.dueDate < today
  ) {
    const paid = parseFloat(inv.paidAmount) || 0
    const total = parseFloat(inv.grandTotal) || 0
    if (paid < total) {
      derivedStatus = "overdue"
    }
  }
  return { ...inv, status: derivedStatus }
}

export async function getMyInvoices(): Promise<
  | { success: true; data: MyInvoice[]; clientId: string }
  | { success: false; error: string; clientId?: undefined }
  | { success: true; data: []; clientId: null }
> {
  const t = await getActionT("actions.activities")

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  // Resolve all client ids belonging to this user: by userId OR by email (covers legacy records where userId not linked yet).
  const email = session.user.email ?? null
  const clientRows = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(
      email
        ? or(
            eq(clientsTable.userId, session.user.id),
            eq(clientsTable.email, email)
          )
        : eq(clientsTable.userId, session.user.id)
    )

  const uniqueIds = [...new Set(clientRows.map((r) => r.id))]
  if (uniqueIds.length === 0)
    return { success: true, data: [], clientId: null }

  const primaryId = uniqueIds[0]

  const invoices = await db
    .select({
      id: invoicesTable.id,
      store_id: invoicesTable.store_id,
      type: invoicesTable.type,
      invoiceNumber: invoicesTable.invoiceNumber,
      clientId: invoicesTable.clientId,
      userId: invoicesTable.userId,
      status: invoicesTable.status,
      issueDate: invoicesTable.issueDate,
      dueDate: invoicesTable.dueDate,
      paidAmount: invoicesTable.paidAmount,
      notes: invoicesTable.notes,
      subtotal: invoicesTable.subtotal,
      discountTotal: invoicesTable.discountTotal,
      taxTotal: invoicesTable.taxTotal,
      grandTotal: invoicesTable.grandTotal,
      projectId: invoicesTable.projectId,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
      outstandingBalance: sql<string>`(${invoicesTable.grandTotal}::numeric - ${invoicesTable.paidAmount}::numeric)::text`,
    })
    .from(invoicesTable)
    .where(inArray(invoicesTable.clientId, uniqueIds))
    .orderBy(sql`${invoicesTable.issueDate} desc`)

  const today = new Date().toISOString().slice(0, 10)

  return {
    success: true,
    data: invoices.map(
      (inv) => deriveOverdueStatus(inv as MyInvoice, today) as MyInvoice
    ),
    clientId: primaryId,
  }
}

export async function getMyInvoiceDetails(
  invoiceId: string
): Promise<
  | {
      success: true
      data: {
        invoice: MyInvoice
        items: InvoiceItem[]
        payments: InvoicePayment[]
      }
    }
  | { success: false; error: string }
> {
  const t = await getActionT("actions.activities")

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  const email = session.user.email ?? null
  const clientRows = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(
      email
        ? or(
            eq(clientsTable.userId, session.user.id),
            eq(clientsTable.email, email)
          )
        : eq(clientsTable.userId, session.user.id)
    )
  const uniqueIds = [...new Set(clientRows.map((r) => r.id))]
  if (uniqueIds.length === 0)
    return { success: false, error: t("forbidden") }

  const invoiceRows = await db
    .select({
      id: invoicesTable.id,
      store_id: invoicesTable.store_id,
      type: invoicesTable.type,
      invoiceNumber: invoicesTable.invoiceNumber,
      clientId: invoicesTable.clientId,
      userId: invoicesTable.userId,
      status: invoicesTable.status,
      issueDate: invoicesTable.issueDate,
      dueDate: invoicesTable.dueDate,
      paidAmount: invoicesTable.paidAmount,
      notes: invoicesTable.notes,
      subtotal: invoicesTable.subtotal,
      discountTotal: invoicesTable.discountTotal,
      taxTotal: invoicesTable.taxTotal,
      grandTotal: invoicesTable.grandTotal,
      projectId: invoicesTable.projectId,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
      outstandingBalance: sql<string>`(${invoicesTable.grandTotal}::numeric - ${invoicesTable.paidAmount}::numeric)::text`,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, invoiceId),
        inArray(invoicesTable.clientId, uniqueIds)
      )
    )
    .limit(1)

  const invoice = invoiceRows[0] as MyInvoice | undefined
  if (!invoice) return { success: false, error: t("forbidden") }

  const today = new Date().toISOString().slice(0, 10)
  const derived = deriveOverdueStatus(invoice, today)

  const [items, payments] = await Promise.all([
    db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, invoiceId)),
    db
      .select()
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
      .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`),
  ])

  return { success: true, data: { invoice: derived, items, payments } }
}
