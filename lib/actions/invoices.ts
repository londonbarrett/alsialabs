"use server"

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
import { returnActionError, sessionAction } from "@/lib/safe-action"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"

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

export const getClientInvoices = sessionAction
  .inputSchema(z.object({ clientId: z.uuid() }))
  .metadata({
    permission: { module: "client-activity", action: "view" },
  })
  .action(async ({ parsedInput, ctx }) => {
    const { clientId } = parsedInput
    const session = ctx.session

    if (session.user.role === "user") {
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

      if (!ownClient) returnActionError("FORBIDDEN")
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

    return invoices as ClientInvoice[]
  })

export const getClientPayments = sessionAction
  .inputSchema(z.object({ clientId: z.uuid() }))
  .metadata({
    permission: { module: "client-activity", action: "view" },
  })
  .action(async ({ parsedInput, ctx }) => {
    const { clientId } = parsedInput
    const session = ctx.session

    if (session.user.role === "user") {
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

      if (!ownClient) returnActionError("FORBIDDEN")
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

    return payments as Array<InvoicePayment & { invoiceNumber: string }>
  })

export const getMyInvoices = sessionAction
  .metadata({})
  .action(async ({ ctx }) => {
    const session = ctx.session
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
    if (uniqueIds.length === 0) {
      return {
        clientId: null as string | null,
        invoices: [] as MyInvoice[],
      }
    }

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

    const derived = invoices.map(
      (inv) => deriveOverdueStatus(inv as MyInvoice, today) as MyInvoice
    )

    return { clientId: primaryId, invoices: derived }
  })

export type MyInvoicesResult = Awaited<
  ReturnType<typeof getMyInvoices>
>["data"]

export const getMyPayments = sessionAction
  .metadata({})
  .action(async ({ ctx }) => {
    const session = ctx.session
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
      return [] as Array<InvoicePayment & { invoiceNumber: string }>

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
      .where(inArray(invoicesTable.clientId, uniqueIds))
      .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`)

    return payments as Array<InvoicePayment & { invoiceNumber: string }>
  })

export const getMyInvoiceDetails = sessionAction
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .metadata({})
  .action(async ({ parsedInput, ctx }) => {
    const { invoiceId } = parsedInput
    const session = ctx.session
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
    if (uniqueIds.length === 0) returnActionError("FORBIDDEN")

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
    if (!invoice) returnActionError("FORBIDDEN")

    const today = new Date().toISOString().slice(0, 10)
    const derived = deriveOverdueStatus(invoice as MyInvoice, today)

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

    return { invoice: derived, items, payments } as {
      invoice: MyInvoice
      items: InvoiceItem[]
      payments: InvoicePayment[]
    }
  })
