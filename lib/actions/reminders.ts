"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientRemindersTable,
  clientsTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const reminderSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  description: z
    .string()
    .min(1, "Description is required")
    .transform((v) => v.trim()),
  remindAt: z.string().refine((v) => {
    const d = new Date(v + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return !isNaN(d.getTime()) && d >= today
  }, "Date must be today or in the future"),
})

export type ReminderFormData = z.infer<typeof reminderSchema>

export async function getReminders(clientId: string) {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return []
  }

  return db
    .select()
    .from(clientRemindersTable)
    .where(
      and(
        eq(clientRemindersTable.clientId, clientId),
        eq(clientRemindersTable.completed, false)
      )
    )
    .orderBy(
      sql`CASE WHEN ${clientRemindersTable.remindAt} < CURRENT_DATE THEN 0 ELSE 1 END`,
      desc(clientRemindersTable.remindAt)
    )
}

export async function upsertReminder(
  data: ReminderFormData,
  reminderId?: string
) {
  const t = await getActionT("actions.reminders")
  try {
    await requirePermission(
      "client-activity",
      reminderId ? "edit" : "create"
    )
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const parsed = reminderSchema.safeParse(data)
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
    description: fields.description,
    remindAt: fields.remindAt,
    createdBy: session.user.id,
    store_id: storeId,
  }

  if (reminderId) {
    const conditions = [eq(clientRemindersTable.id, reminderId)]
    if (storeId) {
      conditions.push(eq(clientRemindersTable.store_id, storeId))
    }
    await db
      .update(clientRemindersTable)
      .set({
        description: sanitized.description,
        remindAt: sanitized.remindAt,
      })
      .where(and(...conditions))
  } else {
    await db.insert(clientRemindersTable).values(sanitized)
  }

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function completeReminder(reminderId: string) {
  const t = await getActionT("actions.reminders")
  try {
    await requirePermission("client-activity", "edit")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(clientRemindersTable.id, reminderId)]
  if (storeId) {
    conditions.push(eq(clientRemindersTable.store_id, storeId))
  }
  await db
    .update(clientRemindersTable)
    .set({
      completed: true,
      completedAt: new Date(),
    })
    .where(and(...conditions))

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function deleteReminder(reminderId: string) {
  const t = await getActionT("actions.reminders")
  try {
    await requirePermission("client-activity", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(clientRemindersTable.id, reminderId)]
  if (storeId) {
    conditions.push(eq(clientRemindersTable.store_id, storeId))
  }
  await db.delete(clientRemindersTable).where(and(...conditions))

  revalidatePath("/dashboard/clients")
  return { success: true as const }
}

export interface ActiveReminder {
  id: string
  clientId: string
  clientName: string
  description: string
  remindAt: string
}

export async function getActiveReminders(): Promise<ActiveReminder[]> {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return []
  }

  const today = new Date().toISOString().split("T")[0]

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(clientRemindersTable.completed, false)]
  if (storeId) {
    conditions.push(eq(clientsTable.store_id, storeId))
  }

  const rows = await db
    .select({
      id: clientRemindersTable.id,
      clientId: clientRemindersTable.clientId,
      clientName: clientsTable.name,
      description: clientRemindersTable.description,
      remindAt: clientRemindersTable.remindAt,
      completed: clientRemindersTable.completed,
    })
    .from(clientRemindersTable)
    .innerJoin(
      clientsTable,
      eq(clientRemindersTable.clientId, clientsTable.id)
    )
    .where(and(...conditions))
    .orderBy(
      sql`CASE WHEN ${clientRemindersTable.remindAt} < ${today} THEN 0 ELSE 1 END`,
      asc(clientRemindersTable.remindAt)
    )

  return rows
}
