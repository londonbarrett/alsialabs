"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
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
  productsTable,
} from "@/lib/drizzle/schema"
import { returnActionError, sessionAction } from "@/lib/safe-action"
import {
  createInvoiceSchema,
  updateInvoiceSchema,
} from "@/lib/schemas/invoice"
import {
  computeInvoiceTotals,
  computeLineTotal,
} from "@/lib/util/invoices"
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

export type InvoiceWithClient = Invoice & {
  clientName: string | null
  outstandingBalance: string
}

// ---------- Sales invoice actions (migrated from sales) ----------

export const getInvoices = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .action(async () => {
    const storeId = await getEffectiveStoreId()

    const base = db
      .select({
        id: invoicesTable.id,
        store_id: invoicesTable.store_id,
        type: invoicesTable.type,
        invoiceNumber: invoicesTable.invoiceNumber,
        clientId: invoicesTable.clientId,
        userId: invoicesTable.userId,
        clientName: clientsTable.name,
        status: invoicesTable.status,
        issueDate: invoicesTable.issueDate,
        dueDate: invoicesTable.dueDate,
        notes: invoicesTable.notes,
        subtotal: invoicesTable.subtotal,
        discountTotal: invoicesTable.discountTotal,
        taxTotal: invoicesTable.taxTotal,
        grandTotal: invoicesTable.grandTotal,
        paidAmount: invoicesTable.paidAmount,
        outstandingBalance: sql<string>`(${invoicesTable.grandTotal}::numeric - ${invoicesTable.paidAmount}::numeric)::text`,
        projectId: invoicesTable.projectId,
        createdAt: invoicesTable.createdAt,
        updatedAt: invoicesTable.updatedAt,
      })
      .from(invoicesTable)
      .leftJoin(
        clientsTable,
        eq(invoicesTable.clientId, clientsTable.id)
      )
      .orderBy(sql`${invoicesTable.createdAt} desc`)

    const invoices = storeId
      ? await base.where(eq(invoicesTable.store_id, storeId))
      : await base

    const today = new Date().toISOString().slice(0, 10)

    return invoices.map((inv) => {
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
    })
  })

export const getInvoiceProducts = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .action(async () => {
    const storeId = await getEffectiveStoreId()
    const base = db
      .select({
        id: productsTable.id,
        name: productsTable.name,
      })
      .from(productsTable)

    return storeId
      ? await base.where(eq(productsTable.store_id, storeId))
      : await base
  })

export type InvoiceProductOption = Awaited<
  ReturnType<typeof getInvoiceProducts>
>["data"] extends (infer U)[]
  ? U
  : never

export const getInvoiceItems = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    return db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, parsedInput.invoiceId))
  })

export const getInvoicePayments = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    return db
      .select()
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.invoiceId, parsedInput.invoiceId))
      .orderBy(sql`${invoicePaymentsTable.createdAt} desc`)
  })

export const createInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "create" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(createInvoiceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const fields = parsedInput
    const totals = computeInvoiceTotals(fields.items)
    const storeId = await getEffectiveStoreId()

    const paid = Math.max(0, parseFloat(fields.paidAmount) || 0)
    const grandTotalNum = parseFloat(totals.grandTotal) || 0
    const initialStatus =
      paid >= grandTotalNum
        ? "paid"
        : paid > 0
          ? "partially_paid"
          : "draft"

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const buf = crypto.getRandomValues(new Uint8Array(8))
    const invoiceNumber =
      "ALSIA-" + Array.from(buf, (b) => chars[b % 36]).join("")

    const [createdInvoice] = await db
      .insert(invoicesTable)
      .values({
        type: fields.type,
        clientId: fields.clientId,
        userId: ctx.session.user.id,
        issueDate: fields.issueDate,
        dueDate: fields.dueDate || null,
        notes: fields.notes || null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        paidAmount: paid.toFixed(2),
        status: initialStatus,
        store_id: storeId,
        invoiceNumber,
      })
      .returning()

    if (paid > 0) {
      await db.insert(invoicePaymentsTable).values({
        invoiceId: createdInvoice.id,
        amount: paid.toFixed(2),
        paymentDate: new Date().toISOString().slice(0, 10),
        userId: ctx.session.user.id,
      })
    }

    for (const item of fields.items) {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      const discPct = parseFloat(item.discountPercent) || 0
      const taxPct = parseFloat(item.taxPercent) || 0
      const { total } = computeLineTotal(qty, price, discPct, taxPct)

      await db.insert(invoiceItemsTable).values({
        invoiceId: createdInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        total: total.toFixed(2),
        productId: item.productId || null,
      })
    }

    return createdInvoice
  })

export const updateInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(updateInvoiceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { invoiceId, ...fields } = parsedInput
    const totals = computeInvoiceTotals(fields.items)
    const storeId = await getEffectiveStoreId()

    const invoiceData = {
      type: fields.type as "product" | "service",
      clientId: fields.clientId,
      userId: ctx.session.user.id,
      issueDate: fields.issueDate,
      dueDate: fields.dueDate || null,
      notes: fields.notes || null,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      store_id: storeId,
    }

    const conditions = [eq(invoicesTable.id, invoiceId)]
    if (storeId) {
      conditions.push(eq(invoicesTable.store_id, storeId))
    }
    const [updatedInvoice] = await db
      .update(invoicesTable)
      .set({
        type: invoiceData.type,
        clientId: invoiceData.clientId,
        userId: invoiceData.userId,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        notes: invoiceData.notes,
        subtotal: invoiceData.subtotal,
        discountTotal: invoiceData.discountTotal,
        taxTotal: invoiceData.taxTotal,
        grandTotal: invoiceData.grandTotal,
        store_id: invoiceData.store_id,
      })
      .where(and(...conditions))
      .returning()

    if (!updatedInvoice) returnActionError("NOT_FOUND")

    await db
      .delete(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, invoiceId))

    for (const item of fields.items) {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      const discPct = parseFloat(item.discountPercent) || 0
      const taxPct = parseFloat(item.taxPercent) || 0
      const { total } = computeLineTotal(qty, price, discPct, taxPct)

      await db.insert(invoiceItemsTable).values({
        invoiceId: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        total: total.toFixed(2),
        productId: item.productId || null,
      })
    }

    return updatedInvoice
  })

export const cancelInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()
    const conditions = [eq(invoicesTable.id, parsedInput.invoiceId)]
    if (storeId) {
      conditions.push(eq(invoicesTable.store_id, storeId))
    }

    await db
      .update(invoicesTable)
      .set({ status: "cancelled" })
      .where(and(...conditions))

    return { success: true as const }
  })

export const reopenInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()
    const conditions = [eq(invoicesTable.id, parsedInput.invoiceId)]
    if (storeId) {
      conditions.push(eq(invoicesTable.store_id, storeId))
    }

    await db
      .update(invoicesTable)
      .set({ status: "draft" })
      .where(and(...conditions))

    return { success: true as const }
  })

export const markInvoiceAsSent = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()
    const conditions = [eq(invoicesTable.id, parsedInput.invoiceId)]
    if (storeId) {
      conditions.push(eq(invoicesTable.store_id, storeId))
    }

    await db
      .update(invoicesTable)
      .set({ status: "sent" })
      .where(and(...conditions))

    return { success: true as const }
  })

export const deleteInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "delete" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()
    const deleteConditions = [
      eq(invoicesTable.id, parsedInput.invoiceId),
    ]
    if (storeId) {
      deleteConditions.push(eq(invoicesTable.store_id, storeId))
    }

    try {
      await db.delete(invoicesTable).where(and(...deleteConditions))
    } catch {
      returnActionError("CANNOT_DELETE_INVOICE")
    }

    return { success: true as const }
  })
