"use server"

import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import { clientsTable, invoicesTable } from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { sql } from "drizzle-orm"
import { z } from "zod"

const daysSchema = z.number().int().positive().max(365).nullable()

export async function getInactiveClients(days: number | null) {
  const t = await getActionT("actions.activity")

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))
  await requirePermission("activity", "view")

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
      comments: clientsTable.comments,
      userId: clientsTable.userId,
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
      clientsTable.location,
      clientsTable.comments,
      clientsTable.userId
    )
    .having(having)
    .orderBy(
      sql`max(${invoicesTable.issueDate}) nulls first, ${clientsTable.name}`
    )
}
