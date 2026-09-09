"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  invoiceItemsTable,
  invoicesTable,
} from "@/lib/drizzle/schema"
import { sessionAction } from "@/lib/safe-action"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"

export const getMonthlyRevenue = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .action(async () => {
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
  })

export const getTopClientsByRevenue = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .inputSchema(
    z.object({
      limit: z.number().int().positive().max(100).default(10),
    })
  )
  .action(async ({ parsedInput }) => {
    const limit = parsedInput.limit ?? 10
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
      .limit(limit)

    return storeId
      ? await query.where(eq(invoicesTable.store_id, storeId))
      : await query
  })
