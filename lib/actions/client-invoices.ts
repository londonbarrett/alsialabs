"use server"

import { db } from "@/lib/drizzle/client"
import { invoicesTable, clientsTable } from "@/lib/drizzle/schema"
import { eq, sql, and } from "drizzle-orm"
import { requirePermission, auth } from "@/lib/auth"
import { z } from "zod"
import { getActionT } from "@/lib/i18n-actions"

const idSchema = z.uuid()

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
  const parsed = idSchema.safeParse(clientId)
  if (!parsed.success)
    return { success: false, error: t("invalidClientId") }

  try {
    await requirePermission("client-activity", "view")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false, error: t("unauthorized") }

  const role = session.user.role

  if (role === "client") {
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
