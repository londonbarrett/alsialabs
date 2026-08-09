"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientActivitiesTable,
  type ClientActivity,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/util/i18n-actions"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const activityType = z.enum(["call", "email", "meeting", "note"])

const activitySchema = z.object({
  clientId: z.uuid("Invalid client ID"),
  type: activityType,
  subject: z
    .string()
    .min(1, "Subject is required")
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  activityDate: z.string().refine((v) => {
    const d = new Date(v + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return !isNaN(d.getTime()) && d <= today
  }, "Date cannot be in the future"),
})

export type ActivityFormData = z.infer<typeof activitySchema>

export type UpsertActivityResult =
  | {
      success: true
      activity: ClientActivity
    }
  | {
      success: false
      error: string
      fieldErrors?: Record<string, string[] | undefined>
    }

export async function getClientActivities(clientId: string) {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return []
  }

  return db
    .select()
    .from(clientActivitiesTable)
    .where(eq(clientActivitiesTable.clientId, clientId))
    .orderBy(desc(clientActivitiesTable.activityDate))
}

const activityPageSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(5),
})

export interface ClientActivityPage {
  activities: ClientActivity[]
  hasMore: boolean
}

export async function getClientActivityPage(
  clientId: string,
  page: { offset?: number; limit?: number } = {}
): Promise<ClientActivityPage> {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return { activities: [], hasMore: false }
  }

  const parsed = activityPageSchema.safeParse({
    offset: page.offset,
    limit: page.limit,
  })
  if (!parsed.success) return { activities: [], hasMore: false }

  const { offset, limit } = parsed.data
  const storeId = await getEffectiveStoreId()
  const conditions = [eq(clientActivitiesTable.clientId, clientId)]
  if (storeId) {
    conditions.push(eq(clientActivitiesTable.store_id, storeId))
  }

  const rows = await db
    .select()
    .from(clientActivitiesTable)
    .where(and(...conditions))
    .orderBy(
      desc(clientActivitiesTable.activityDate),
      desc(clientActivitiesTable.createdAt),
      desc(clientActivitiesTable.id)
    )
    .limit(limit + 1)
    .offset(offset)

  return {
    activities: rows.slice(0, limit),
    hasMore: rows.length > limit,
  }
}

export async function upsertActivity(
  data: ActivityFormData,
  activityId?: string
): Promise<UpsertActivityResult> {
  const t = await getActionT("actions.activities")
  try {
    await requirePermission(
      "client-activity",
      activityId ? "edit" : "create"
    )
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const parsed = activitySchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data
  const session = await auth()
  if (!session?.user?.id)
    return { success: false, error: t("unauthorized") }

  const storeId = await getEffectiveStoreId()

  const sanitized = {
    clientId: fields.clientId,
    type: fields.type,
    subject: fields.subject,
    description: fields.description || null,
    activityDate: fields.activityDate,
    performedBy: session.user.id,
    store_id: storeId,
  }

  let activity: ClientActivity
  if (activityId) {
    const conditions = [eq(clientActivitiesTable.id, activityId)]
    if (storeId) {
      conditions.push(eq(clientActivitiesTable.store_id, storeId))
    }
    const [updated] = await db
      .update(clientActivitiesTable)
      .set({
        type: sanitized.type,
        subject: sanitized.subject,
        description: sanitized.description,
        activityDate: sanitized.activityDate,
      })
      .where(and(...conditions))
      .returning()
    if (!updated)
      return { success: false, error: t("invalidActivityId") }
    activity = updated
  } else {
    const [inserted] = await db
      .insert(clientActivitiesTable)
      .values(sanitized)
      .returning()
    if (!inserted)
      return { success: false, error: t("validationFailed") }
    activity = inserted
  }

  revalidatePath("/dashboard/clients")
  revalidatePath("/dashboard/activity")
  return { success: true, activity }
}

export async function deleteActivity(activityId: string) {
  const t = await getActionT("actions.activities")
  try {
    await requirePermission("client-activity", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(clientActivitiesTable.id, activityId)]
  if (storeId) {
    conditions.push(eq(clientActivitiesTable.store_id, storeId))
  }
  await db.delete(clientActivitiesTable).where(and(...conditions))

  revalidatePath("/dashboard/clients")
  revalidatePath("/dashboard/activity")
  return { success: true as const }
}
