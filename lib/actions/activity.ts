"use server"

import { auth, requirePermission } from "@/lib/auth"
import { getEffectiveStoreId } from "@/lib/actions/stores"
import { db } from "@/lib/drizzle/client"
import {
  clientActivitiesTable,
  clientsTable,
  invoicesTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { eq, sql } from "drizzle-orm"
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

  const storeId = await getEffectiveStoreId()
  const query = db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      email: clientsTable.email,
      phone: clientsTable.phone,
      location: clientsTable.location,
      comments: clientsTable.comments,
      userId: clientsTable.userId,
      lastInvoiceDate: sql<string>`max(${invoicesTable.issueDate})`,
      activityCount: sql<number>`(
        select count(*) from ${clientActivitiesTable}
        where ${clientActivitiesTable.clientId} = ${clientsTable.id}
      )`,
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

  return storeId
    ? query.where(eq(clientsTable.store_id, storeId))
    : query
}
