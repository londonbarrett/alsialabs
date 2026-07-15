"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/drizzle/client"
import { clientRemindersTable, clientsTable } from "@/lib/drizzle/schema"
import { eq, desc, and, asc, gte } from "drizzle-orm"
import { requirePermission, auth } from "@/lib/auth"
import { z } from "zod"
import { getActionT } from "@/lib/i18n-actions"

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
    .where(eq(clientRemindersTable.clientId, clientId))
    .orderBy(desc(clientRemindersTable.remindAt))
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

  const sanitized = {
    clientId: fields.clientId,
    description: fields.description,
    remindAt: fields.remindAt,
    createdBy: session.user.id,
  }

  if (reminderId) {
    await db
      .update(clientRemindersTable)
      .set({
        description: sanitized.description,
        remindAt: sanitized.remindAt,
      })
      .where(eq(clientRemindersTable.id, reminderId))
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

  await db
    .update(clientRemindersTable)
    .set({
      completed: true,
      completedAt: new Date(),
    })
    .where(eq(clientRemindersTable.id, reminderId))

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

  await db
    .delete(clientRemindersTable)
    .where(eq(clientRemindersTable.id, reminderId))

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
    .where(
      and(
        eq(clientRemindersTable.completed, false),
        gte(clientRemindersTable.remindAt, today)
      )
    )
    .orderBy(asc(clientRemindersTable.remindAt))

  return rows
}
