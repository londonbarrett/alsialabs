import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
  productsTable,
  projectsTable,
} from "@/lib/drizzle/schema"
import {
  computeInvoiceTotals,
  computeLineTotal,
} from "@/lib/util/invoices"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { CreateInvoiceDTO, UpdateInvoiceDTO } from "./schemas"

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

const MY_INVOICE_COLUMNS = {
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
  projectName: projectsTable.name,
  createdAt: invoicesTable.createdAt,
  updatedAt: invoicesTable.updatedAt,
  outstandingBalance: sql<string>`(${invoicesTable.grandTotal}::numeric - ${invoicesTable.paidAmount}::numeric)::text`,
}

const PAYMENT_WITH_NUMBER_COLUMNS = {
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
}

// ---------- Client / session scope ----------

async function getOwnClientRow(userId: string, clientId: string) {
  return db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.userId, userId),
        eq(clientsTable.id, clientId)
      )
    )
    .then((rows) => rows[0])
}

async function getSessionClientIds(
  userId: string,
  email: string | null
): Promise<string[]> {
  const clientRows = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(
      email
        ? or(
            eq(clientsTable.userId, userId),
            eq(clientsTable.email, email)
          )
        : eq(clientsTable.userId, userId)
    )

  return [...new Set(clientRows.map((r) => r.id))]
}

async function getClientInvoicesByClientId(clientId: string) {
  return db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.clientId, clientId))
    .orderBy(sql`${invoicesTable.issueDate} desc`)
}

async function getClientPaymentsByClientId(clientId: string) {
  return db
    .select(PAYMENT_WITH_NUMBER_COLUMNS)
    .from(invoicePaymentsTable)
    .innerJoin(
      invoicesTable,
      eq(invoicePaymentsTable.invoiceId, invoicesTable.id)
    )
    .where(eq(invoicesTable.clientId, clientId))
    .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`)
}

// ---------- My invoices ----------

async function getMyInvoiceRows(clientIds: string[]) {
  const rows = await db
    .select(MY_INVOICE_COLUMNS)
    .from(invoicesTable)
    .leftJoin(
      projectsTable,
      eq(invoicesTable.projectId, projectsTable.id)
    )
    .where(inArray(invoicesTable.clientId, clientIds))
    .orderBy(sql`${invoicesTable.issueDate} desc`)

  const today = new Date().toISOString().slice(0, 10)
  return rows.map((inv) => deriveOverdueStatus(inv, today))
}

async function getMyPaymentsByClientIds(clientIds: string[]) {
  return db
    .select(PAYMENT_WITH_NUMBER_COLUMNS)
    .from(invoicePaymentsTable)
    .innerJoin(
      invoicesTable,
      eq(invoicePaymentsTable.invoiceId, invoicesTable.id)
    )
    .where(inArray(invoicesTable.clientId, clientIds))
    .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`)
}

async function getMyInvoiceRow(invoiceId: string, clientIds: string[]) {
  const rows = await db
    .select(MY_INVOICE_COLUMNS)
    .from(invoicesTable)
    .leftJoin(
      projectsTable,
      eq(invoicesTable.projectId, projectsTable.id)
    )
    .where(
      and(
        eq(invoicesTable.id, invoiceId),
        inArray(invoicesTable.clientId, clientIds)
      )
    )
    .limit(1)

  const invoice = rows[0]
  if (!invoice) return undefined

  const today = new Date().toISOString().slice(0, 10)
  return deriveOverdueStatus(invoice, today)
}

async function getInvoiceItemsByInvoiceId(invoiceId: string) {
  return db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId))
}

async function getMyInvoicePaymentsByInvoiceId(invoiceId: string) {
  return db
    .select()
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(sql`${invoicePaymentsTable.paymentDate} desc`)
}

async function getInvoicePaymentsByInvoiceId(invoiceId: string) {
  return db
    .select()
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(sql`${invoicePaymentsTable.createdAt} desc`)
}

async function getInvoiceClientId(invoiceId: string) {
  return db
    .select({ clientId: invoicesTable.clientId })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1)
    .then((rows) => rows[0])
}

async function getOwnedProjectRow(projectId: string, userId: string) {
  return db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.primaryOwnerId, userId)
      )
    )
    .limit(1)
    .then((rows) => rows[0])
}

// ---------- Project invoices ----------

async function getProjectInvoicesByProjectId(projectId: string) {
  return db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      status: invoicesTable.status,
      paidAmount: invoicesTable.paidAmount,
      issueDate: invoicesTable.issueDate,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.projectId, projectId))
    .orderBy(invoicesTable.issueDate)
}

// ---------- Sales ----------

async function getSalesInvoices(storeId: string | null) {
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
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(sql`${invoicesTable.createdAt} desc`)

  const invoices = storeId
    ? await base.where(eq(invoicesTable.store_id, storeId))
    : await base

  const today = new Date().toISOString().slice(0, 10)
  return invoices.map((inv) => deriveOverdueStatus(inv, today))
}

async function getInvoiceProductOptions(storeId: string | null) {
  const base = db
    .select({
      id: productsTable.id,
      name: productsTable.name,
    })
    .from(productsTable)

  return storeId
    ? await base.where(eq(productsTable.store_id, storeId))
    : await base
}

// ---------- Writes ----------

async function createInvoice(
  values: CreateInvoiceDTO,
  userId: string,
  storeId: string | null
) {
  const totals = computeInvoiceTotals(values.items)

  const paid = Math.max(0, parseFloat(values.paidAmount) || 0)
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
      type: values.type,
      clientId: values.clientId,
      userId,
      issueDate: values.issueDate,
      dueDate: values.dueDate || null,
      notes: values.notes || null,
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
      userId,
    })
  }

  for (const item of values.items) {
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
}

async function updateInvoice(
  values: UpdateInvoiceDTO,
  userId: string,
  storeId: string | null
) {
  const { invoiceId, ...fields } = values
  const totals = computeInvoiceTotals(fields.items)

  const invoiceData = {
    type: fields.type as "product" | "service",
    clientId: fields.clientId,
    userId,
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

  if (!updatedInvoice) return undefined

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
}

async function updateInvoiceStatus(
  invoiceId: string,
  status: "cancelled" | "draft" | "sent",
  storeId: string | null
): Promise<void> {
  const conditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    conditions.push(eq(invoicesTable.store_id, storeId))
  }

  await db
    .update(invoicesTable)
    .set({ status })
    .where(and(...conditions))
}

async function updateInvoiceProject(
  invoiceId: string,
  projectId: string | null
) {
  const [updated] = await db
    .update(invoicesTable)
    .set({ projectId })
    .where(eq(invoicesTable.id, invoiceId))
    .returning({
      id: invoicesTable.id,
      projectId: invoicesTable.projectId,
    })

  return updated
}

async function deleteInvoice(
  invoiceId: string,
  storeId: string | null
): Promise<void> {
  const deleteConditions = [eq(invoicesTable.id, invoiceId)]
  if (storeId) {
    deleteConditions.push(eq(invoicesTable.store_id, storeId))
  }

  await db.delete(invoicesTable).where(and(...deleteConditions))
}

// ---------- Composed queries ----------

async function getMyInvoices(userId: string, email: string | null) {
  const uniqueIds = await getSessionClientIds(userId, email)
  if (uniqueIds.length === 0) {
    return {
      clientId: null,
      invoices: [],
    }
  }

  const invoices = await getMyInvoiceRows(uniqueIds)

  return { clientId: uniqueIds[0], invoices }
}

async function getMyPayments(userId: string, email: string | null) {
  const uniqueIds = await getSessionClientIds(userId, email)
  if (uniqueIds.length === 0) return []

  return getMyPaymentsByClientIds(uniqueIds)
}

async function getMyInvoiceDetails(
  invoiceId: string,
  userId: string,
  email: string | null
) {
  const uniqueIds = await getSessionClientIds(userId, email)
  if (uniqueIds.length === 0) return null

  const invoice = await getMyInvoiceRow(invoiceId, uniqueIds)
  if (!invoice) return null

  const [items, payments] = await Promise.all([
    getInvoiceItemsByInvoiceId(invoiceId),
    getMyInvoicePaymentsByInvoiceId(invoiceId),
  ])

  return { invoice, items, payments }
}

const queries = {
  getOwnClientRow,
  getSessionClientIds,
  getClientInvoicesByClientId,
  getClientPaymentsByClientId,
  getMyInvoices,
  getMyPayments,
  getMyInvoiceDetails,
  getInvoiceClientId,
  getOwnedProjectRow,
  updateInvoiceProject,
  getProjectInvoicesByProjectId,
  getSalesInvoices,
  getInvoiceProductOptions,
  getInvoiceItemsByInvoiceId,
  getInvoicePaymentsByInvoiceId,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
}

export default queries
