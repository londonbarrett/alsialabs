"use server"

import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import { clientsTable, invoiceItemsTable, invoicesTable } from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { sql } from "drizzle-orm"
import { z } from "zod"

const limitSchema = z.number().int().positive().max(100)
const daysSchema = z.number().int().positive().max(365).nullable()

export async function getMonthlyRevenue() {
  const t = await getActionT("actions.reports")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("reports", "view")

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
    .where(sql`${invoiceItemsTable.unitPrice} > 0`)
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
  const t = await getActionT("actions.reports")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("reports", "view")

  const { data, error } = limitSchema.safeParse(limit)
  if (error) throw new Error(t("invalidLimit"))
  return db
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
}

export async function getInactiveClients(days: number | null) {
  const t = await getActionT("actions.reports")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("reports", "view")

  const { data, error } = daysSchema.safeParse(days)
  if (error) throw new Error(t("invalidDays"))

  const threshold =
    data !== null
      ? new Date(Date.now() - data * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      : null

  const having =
    days === null
      ? sql`count(${invoicesTable.id}) = 0`
      : sql`max(${invoicesTable.issueDate}) < ${threshold} and max(${invoicesTable.issueDate}) is not null`

  return db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      email: clientsTable.email,
      phone: clientsTable.phone,
      location: clientsTable.location,
      lastInvoiceDate: sql<string>`max(${invoicesTable.issueDate})`,
    })
    .from(clientsTable)
    .leftJoin(
      invoicesTable,
      sql`${invoicesTable.clientId} = ${clientsTable.id}`
    )
    .groupBy(
      clientsTable.id,
      clientsTable.name,
      clientsTable.email,
      clientsTable.phone,
      clientsTable.location
    )
    .having(having)
    .orderBy(
      sql`max(${invoicesTable.issueDate}) nulls first, ${clientsTable.name}`
    )
}
