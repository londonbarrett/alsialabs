"use server"

import { getEffectiveStoreId } from "@/actions/not-safe/stores"
import type {
  ClientTimelineEntryDTO,
  ClientTimelinePageDTO,
} from "@/actions/schemas/client-timeline"
import { ClientTimelinePageInputSchema } from "@/actions/schemas/client-timeline"
import { ClientActivityRecordSchema } from "@/actions/schemas/activity"
import { runAction } from "@/lib/action-result"
import { requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientActivitiesTable,
  clientRemindersTable,
} from "@/lib/drizzle/schema"
import { and, desc, eq } from "drizzle-orm"

function getEntryDate(entry: ClientTimelineEntryDTO): string {
  return entry.kind === "activity" ? entry.activityDate : entry.remindAt
}

function sortEntries(
  entries: ClientTimelineEntryDTO[]
): ClientTimelineEntryDTO[] {
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
) {
  return runAction<ClientTimelinePageDTO>(async () => {
    try {
      await requirePermission("client-activity", "view")
    } catch {
      return { entries: [], hasMore: false }
    }

    const parsed = ClientTimelinePageInputSchema.safeParse({
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
      activityConditions.push(
        eq(clientActivitiesTable.store_id, storeId)
      )
      reminderConditions.push(
        eq(clientRemindersTable.store_id, storeId)
      )
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

    const entries: ClientTimelineEntryDTO[] = sortEntries([
      ...activities.map((a) => ({
        ...ClientActivityRecordSchema.parse(a),
        kind: "activity" as const,
      })),
      ...reminders.map((r) => ({
        ...r,
        kind: "reminder" as const,
      })),
    ])

    return {
      entries: entries.slice(offset, offset + limit),
      hasMore: entries.length > offset + limit,
    }
  })
}
