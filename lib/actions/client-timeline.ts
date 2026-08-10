"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientActivitiesTable,
  clientRemindersTable,
  type ClientActivity,
  type ClientReminder,
} from "@/lib/drizzle/schema"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

export type ClientTimelineEntry =
  | ({ kind: "activity" } & ClientActivity)
  | ({ kind: "reminder" } & ClientReminder)

const pageSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(5),
})

function getEntryDate(entry: ClientTimelineEntry): string {
  return entry.kind === "activity" ? entry.activityDate : entry.remindAt
}

function sortEntries(
  entries: ClientTimelineEntry[]
): ClientTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = new Date(getEntryDate(a)).getTime()
    const dateB = new Date(getEntryDate(b)).getTime()
    if (dateB !== dateA) return dateB - dateA
    const createdA = new Date(a.createdAt).getTime()
    const createdB = new Date(b.createdAt).getTime()
    if (createdB !== createdA) return createdB - createdA
    return String(a.id).localeCompare(String(b.id))
  })
}

export async function getClientTimelinePage(
  clientId: string,
  page: { offset?: number; limit?: number } = {}
): Promise<{ entries: ClientTimelineEntry[]; hasMore: boolean }> {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return { entries: [], hasMore: false }
  }

  const parsed = pageSchema.safeParse({
    offset: page.offset,
    limit: page.limit,
  })
  if (!parsed.success) return { entries: [], hasMore: false }

  const { offset, limit } = parsed.data
  const storeId = await getEffectiveStoreId()

  const activityConditions = [
    eq(clientActivitiesTable.clientId, clientId),
  ]
  const reminderConditions = [
    eq(clientRemindersTable.clientId, clientId),
    eq(clientRemindersTable.completed, false),
  ]
  if (storeId) {
    activityConditions.push(eq(clientActivitiesTable.store_id, storeId))
    reminderConditions.push(eq(clientRemindersTable.store_id, storeId))
  }

  const [activities, reminders] = await Promise.all([
    db
      .select()
      .from(clientActivitiesTable)
      .where(and(...activityConditions))
      .orderBy(
        desc(clientActivitiesTable.activityDate),
        desc(clientActivitiesTable.createdAt),
        desc(clientActivitiesTable.id)
      ),
    db
      .select()
      .from(clientRemindersTable)
      .where(and(...reminderConditions)),
  ])

  const entries = sortEntries([
    ...activities.map((a) => ({ ...a, kind: "activity" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
  ])

  return {
    entries: entries.slice(offset, offset + limit),
    hasMore: entries.length > offset + limit,
  }
}
