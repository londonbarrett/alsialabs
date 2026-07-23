"use server"

import { auth, isSuperUser, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  invoiceItemsTable,
  invoicesTable,
  productsTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z
    .string()
    .min(1, "Description is required")
    .transform((v) => v.trim()),
  quantity: z.string().min(1, "Quantity is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
  discountPercent: z.string().optional().default("0"),
  taxPercent: z.string().optional().default("0"),
  productId: z.string().nullable().optional(),
})

const invoiceSchema = z.object({
  type: z.enum(["product", "service"]),
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  notes: z.string().optional().default(""),
  items: z
    .array(lineItemSchema)
    .min(1, "At least one line item is required"),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

function computeLineTotal(
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

function computeInvoiceTotals(
  items: Array<{
    quantity: string
    unitPrice: string
    discountPercent: string
    taxPercent: string
  }>
) {
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

export interface InvoiceWithClient {
  id: string
  type: string
  invoiceNumber: string
  clientId: string
  userId: string | null
  clientName: string | null
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

export interface InvoiceItemData {
  id: string
  invoiceId: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
  total: string
  productId: string | null
}

export async function getInvoices() {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const invoices = await db
    .select({
      id: invoicesTable.id,
      type: invoicesTable.type,
      invoiceNumber: invoicesTable.invoiceNumber,
      clientId: invoicesTable.clientId,
      userId: invoicesTable.userId,
      clientName: clientsTable.name,
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
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(sql`${invoicesTable.createdAt} desc`)

  return invoices
}

export async function getInvoiceProducts() {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
    })
    .from(productsTable)
}

export type InvoiceProductOption = Awaited<
  ReturnType<typeof getInvoiceProducts>
>[number]

export async function getInvoiceItems(
  invoiceId: string
): Promise<InvoiceItemData[]> {
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

  const invoiceData = {
    type: fields.type,
    clientId: fields.clientId,
    userId: session.user.id,
    issueDate: fields.issueDate,
    notes: fields.notes || null,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
  }

  if (invoiceId) {
    await db
      .update(invoicesTable)
      .set(invoiceData)
      .where(eq(invoicesTable.id, invoiceId))

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
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const buf = crypto.getRandomValues(new Uint8Array(8))
    const invoiceNumber =
      "ALSIA-" + Array.from(buf, (b) => chars[b % 36]).join("")

    const [created] = await db
      .insert(invoicesTable)
      .values({ ...invoiceData, invoiceNumber })
      .returning({ id: invoicesTable.id })

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

export async function deleteInvoice(invoiceId: string) {
  const t = await getActionT("actions.sales")
  try {
    await requirePermission("sales", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!isSuperUser(session)) {
    const invoice = await db
      .select({ userId: invoicesTable.userId })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .then((rows) => rows[0])

    if (invoice && invoice.userId !== session.user.id) {
      return { success: false as const, error: t("forbidden") }
    }
  }

  try {
    await db
      .delete(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
  } catch {
    return { success: false as const, error: t("cannotDelete") }
  }

  revalidatePath("/dashboard/sales")
  return { success: true as const }
}
