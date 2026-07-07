"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/drizzle/client"
import { activitiesTable } from "@/lib/drizzle/schema"
import { eq, desc } from "drizzle-orm"
import { requirePermission, auth, isSuperUser } from "@/lib/auth"
import { z } from "zod"
import { getActionT } from "@/lib/i18n-actions"

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

const idSchema = z.uuid()

export type ActivityFormData = z.infer<typeof activitySchema>

export async function getActivities(clientId: string) {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return []
  }

  const idParsed = idSchema.safeParse(clientId)
  if (!idParsed.success) return []

  return db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.clientId, idParsed.data))
    .orderBy(desc(activitiesTable.activityDate))
}

export async function upsertActivity(
  data: ActivityFormData,
  activityId?: string
) {
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

  const sanitized = {
    clientId: fields.clientId,
    type: fields.type,
    subject: fields.subject,
    description: fields.description || null,
    activityDate: fields.activityDate,
    performedBy: session.user.id,
  }

  if (activityId) {
    const idParsed = idSchema.safeParse(activityId)
    if (!idParsed.success)
      return { success: false, error: t("invalidActivityId") }

    await db
      .update(activitiesTable)
      .set({
        type: sanitized.type,
        subject: sanitized.subject,
        description: sanitized.description,
        activityDate: sanitized.activityDate,
      })
      .where(eq(activitiesTable.id, idParsed.data))
  } else {
    await db.insert(activitiesTable).values(sanitized)
  }

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function deleteActivity(activityId: string) {
  const t = await getActionT("actions.activities")
  try {
    await requirePermission("client-activity", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user?.id || !isSuperUser(session)) {
    return { success: false as const, error: t("onlySuperCanDelete") }
  }

  const idParsed = idSchema.safeParse(activityId)
  if (!idParsed.success)
    return { success: false as const, error: t("invalidActivityId") }

  await db
    .delete(activitiesTable)
    .where(eq(activitiesTable.id, idParsed.data))

  revalidatePath("/dashboard/clients")
  return { success: true as const }
}
