"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import type { Invoice, InvoiceItem } from "@/lib/drizzle/schema"
import {
  clientsTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
  productsTable,
} from "@/lib/drizzle/schema"
import {
  computeLineTotal,
  computeInvoiceTotals,
} from "@/lib/sales/totals"
import { getActionT } from "@/lib/util/i18n-actions"
import { and, eq, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .transform((v) => v.trim()),
  quantity: z.string().min(1, { message: "Quantity is required" }),
  unitPrice: z.string().min(1, { message: "Unit price is required" }),
  discountPercent: z.string().optional().default("0"),
  taxPercent: z.string().optional().default("0"),
  productId: z.string().nullable().optional(),
})

const invoiceSchema = z.object({
  type: z.enum(["product", "service"]),
  clientId: z.string().min(1, { message: "Client is required" }),
  issueDate: z.string().min(1, { message: "Issue date is required" }),
  dueDate: z.string().optional().default(""),
  paidAmount: z.string().optional().default("0"),
  notes: z.string().optional().default(""),
  items: z
    .array(lineItemSchema)
    .min(1, { message: "At least one line item is required" }),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

export type InvoiceWithClient = Invoice & {
  clientName: string | null
  outstandingBalance: string
}

export async function getInvoices() {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const storeId = await getEffectiveStoreId()

  const query = db
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
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(sql`${invoicesTable.createdAt} desc`)

  const invoices = storeId
    ? await query.where(eq(invoicesTable.store_id, storeId))
    : await query

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
}

export async function getInvoiceProducts() {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const storeId = await getEffectiveStoreId()
  const query = db
    .select({
      id: productsTable.id,
      name: productsTable.name,
    })
    .from(productsTable)

  return storeId
    ? query.where(eq(productsTable.store_id, storeId))
    : query
}

export type InvoiceProductOption = Awaited<
  ReturnType<typeof getInvoiceProducts>
>[number]

export async function getInvoiceItems(
  invoiceId: string
): Promise<InvoiceItem[]> {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId))
}

export async function upsertInvoice(
  data: InvoiceFormData,
  invoiceId?: string
) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", invoiceId ? "edit" : "create")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  const parsed = invoiceSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data
  const totals = computeInvoiceTotals(fields.items)

  const storeId = await getEffectiveStoreId()

  const invoiceData = {
    type: fields.type as "product" | "service",
    clientId: fields.clientId,
    userId: session.user.id,
    issueDate: fields.issueDate,
    dueDate: fields.dueDate || null,
    notes: fields.notes || null,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    store_id: storeId,
  }

  if (invoiceId) {
    const conditions = [eq(invoicesTable.id, invoiceId)]
    if (storeId) {
      conditions.push(eq(invoicesTable.store_id, storeId))
    }
    await db
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
  } else {
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

    const [created] = await db
      .insert(invoicesTable)
      .values({
        type: fields.type,
        clientId: fields.clientId,
        userId: session.user.id,
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
      .returning({ id: invoicesTable.id })

    if (paid > 0) {
      await db.insert(invoicePaymentsTable).values({
        invoiceId: created.id,
        amount: paid.toFixed(2),
        paymentDate: new Date().toISOString().slice(0, 10),
        userId: session.user.id,
      })
    }

    for (const item of fields.items) {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      const discPct = parseFloat(item.discountPercent) || 0
      const taxPct = parseFloat(item.taxPercent) || 0
      const { total } = computeLineTotal(qty, price, discPct, taxPct)

      await db.insert(invoiceItemsTable).values({
        invoiceId: created.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        total: total.toFixed(2),
        productId: item.productId || null,
      })
    }
  }

  revalidatePath("/dashboard/sales")
  return { success: true }
}

const paymentSchema = z.object({
  amount: z.string().min(1, { message: "Amount is required" }),
  paymentDate: z
    .string()
    .min(1, { message: "Payment date is required" }),
  method: z.string().optional().default(""),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
})

export async function recordPayment(
  invoiceId: string,
  data: z.infer<typeof paymentSchema>
) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "record-payment")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data
  const amount = parseFloat(fields.amount) || 0

  if (amount <= 0) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const [invoice] = await db
    .select({
      grandTotal: invoicesTable.grandTotal,
      paidAmount: invoicesTable.paidAmount,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1)

  if (!invoice) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  if (invoice.status === "cancelled") {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const currentPaid = parseFloat(invoice.paidAmount) || 0
  const grandTotal = parseFloat(invoice.grandTotal) || 0
  const remaining = grandTotal - currentPaid

  if (amount > remaining) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const newPaid = currentPaid + amount
  const newStatus = newPaid >= grandTotal ? "paid" : "partially_paid"

  await db.transaction(async (tx) => {
    await tx
      .update(invoicesTable)
      .set({
        paidAmount: newPaid.toFixed(2),
        status: newStatus,
      })
      .where(eq(invoicesTable.id, invoiceId))

    await tx.insert(invoicePaymentsTable).values({
      invoiceId,
      amount: fields.amount,
      paymentDate: fields.paymentDate,
      method: fields.method || null,
      reference: fields.reference || null,
      notes: fields.notes || null,
      userId: session.user.id,
    })
  })

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function syncInvoicePaymentState(tx: DbTx, invoiceId: string) {
  const [invoice] = await tx
    .select({
      grandTotal: invoicesTable.grandTotal,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1)

  if (!invoice) return

  const [sumResult] = await tx
    .select({
      total: sql<string>`coalesce(sum(${invoicePaymentsTable.amount})::numeric, 0)::text`,
    })
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))

  const paid = parseFloat(sumResult.total) || 0
  const grandTotal = parseFloat(invoice.grandTotal) || 0

  let status:
    | "draft"
    | "sent"
    | "paid"
    | "partially_paid"
    | "overdue"
    | "cancelled"
  if (invoice.status === "cancelled") {
    status = "cancelled"
  } else if (paid >= grandTotal) {
    status = "paid"
  } else if (paid > 0) {
    status = "partially_paid"
  } else {
    status = "draft"
  }

  await tx
    .update(invoicesTable)
    .set({ paidAmount: paid.toFixed(2), status })
    .where(eq(invoicesTable.id, invoiceId))
}

export async function updatePayment(
  paymentId: string,
  data: z.infer<typeof paymentSchema>
) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "record-payment")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data
  const newAmount = parseFloat(fields.amount) || 0

  if (newAmount <= 0) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const [payment] = await db
    .select({ invoiceId: invoicePaymentsTable.invoiceId })
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.id, paymentId))
    .limit(1)

  if (!payment) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const [invoice] = await db
    .select({ grandTotal: invoicesTable.grandTotal })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, payment.invoiceId))
    .limit(1)

  if (!invoice) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  const grandTotal = parseFloat(invoice.grandTotal) || 0

  let ok = true
  let error: string | undefined

  await db.transaction(async (tx) => {
    const [others] = await tx
      .select({
        total: sql<string>`coalesce(sum(${invoicePaymentsTable.amount})::numeric, 0)::text`,
      })
      .from(invoicePaymentsTable)
      .where(
        and(
          eq(invoicePaymentsTable.invoiceId, payment.invoiceId),
          ne(invoicePaymentsTable.id, paymentId)
        )
      )

    const othersTotal = parseFloat(others.total) || 0
    if (othersTotal + newAmount > grandTotal) {
      ok = false
      error = t("common.somethingWentWrong")
      return
    }

    await tx
      .update(invoicePaymentsTable)
      .set({
        amount: fields.amount,
        paymentDate: fields.paymentDate,
        method: fields.method || null,
        reference: fields.reference || null,
        notes: fields.notes || null,
      })
      .where(eq(invoicePaymentsTable.id, paymentId))

    await syncInvoicePaymentState(tx, payment.invoiceId)
  })

  if (!ok) return { success: false as const, error: error! }

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

export async function deletePayment(paymentId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "record-payment")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const [payment] = await db
    .select({ invoiceId: invoicePaymentsTable.invoiceId })
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.id, paymentId))
    .limit(1)

  if (!payment) {
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.id, paymentId))
    await syncInvoicePaymentState(tx, payment.invoiceId)
  })

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

export async function cancelInvoice(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    conditions.push(eq(invoicesTable.store_id, storeId))
  }

  await db
    .update(invoicesTable)
    .set({ status: "cancelled" })
    .where(and(...conditions))

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

export async function reopenInvoice(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    conditions.push(eq(invoicesTable.store_id, storeId))
  }

  await db
    .update(invoicesTable)
    .set({ status: "draft" })
    .where(and(...conditions))

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

export async function markInvoiceAsSent(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    conditions.push(eq(invoicesTable.store_id, storeId))
  }

  await db
    .update(invoicesTable)
    .set({ status: "sent" })
    .where(and(...conditions))

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

export async function getInvoicePayments(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select()
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(sql`${invoicePaymentsTable.createdAt} desc`)
}

export async function deleteInvoice(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const deleteConditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    deleteConditions.push(eq(invoicesTable.store_id, storeId))
  }

  try {
    await db.delete(invoicesTable).where(and(...deleteConditions))
  } catch {
    return { success: false as const, error: t("cannotDelete") }
  }

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}

const limitSchema = z.number().int().positive().max(100)

export async function getMonthlyRevenue() {
  const t = await getActionT("actions.sales")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("sales", "view")

  const storeId = await getEffectiveStoreId()

  const conditions = [sql`${invoiceItemsTable.unitPrice} > 0`]
  if (storeId) {
    conditions.push(eq(invoicesTable.store_id, storeId))
  }

  const rows = await db
    .select({
      month: sql<string>`to_char(${invoicesTable.issueDate}, 'YYYY-MM')`,
      type: invoicesTable.type,
      revenue: sql<string>`sum(${invoiceItemsTable.total})`,
      quantity: sql<string>`sum(${invoiceItemsTable.quantity})`,
    })
    .from(invoicesTable)
    .innerJoin(
      invoiceItemsTable,
      sql`${invoiceItemsTable.invoiceId} = ${invoicesTable.id}`
    )
    .where(and(...conditions))
    .groupBy(sql`1`, invoicesTable.type)
    .orderBy(sql`1`)

  const map = new Map<
    string,
    {
      month: string
      productRevenue: number
      serviceRevenue: number
      productQuantity: number
      serviceQuantity: number
    }
  >()

  for (const row of rows) {
    if (!map.has(row.month)) {
      map.set(row.month, {
        month: row.month,
        productRevenue: 0,
        serviceRevenue: 0,
        productQuantity: 0,
        serviceQuantity: 0,
      })
    }
    const entry = map.get(row.month)!
    if (row.type === "product") {
      entry.productRevenue += Number(row.revenue)
      entry.productQuantity += Number(row.quantity)
    } else {
      entry.serviceRevenue += Number(row.revenue)
      entry.serviceQuantity += Number(row.quantity)
    }
  }

  return Array.from(map.values())
}

export async function getTopClientsByRevenue(limit = 10) {
  const t = await getActionT("actions.sales")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("sales", "view")

  const { data, error } = limitSchema.safeParse(limit)
  if (error) throw new Error(t("invalidLimit"))

  const storeId = await getEffectiveStoreId()
  const query = db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      totalRevenue: sql<string>`sum(${invoicesTable.grandTotal})`,
      invoiceCount: sql<number>`count(${invoicesTable.id})`,
    })
    .from(invoicesTable)
    .innerJoin(
      clientsTable,
      sql`${invoicesTable.clientId} = ${clientsTable.id}`
    )
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(sql`sum(${invoicesTable.grandTotal}) desc`)
    .limit(data)

  return storeId
    ? query.where(eq(invoicesTable.store_id, storeId))
    : query
}
