"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/drizzle/client"
import { remindersTable } from "@/lib/drizzle/schema"
import { eq, desc } from "drizzle-orm"
import { requirePermission, auth } from "@/lib/auth"
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

const idSchema = z.uuid()

export type ReminderFormData = z.infer<typeof reminderSchema>

export async function getReminders(clientId: string) {
  try {
    await requirePermission("client-activity", "view")
  } catch {
    return []
  }

  const idParsed = idSchema.safeParse(clientId)
  if (!idParsed.success) return []

  return db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.clientId, idParsed.data))
    .orderBy(desc(remindersTable.remindAt))
}

export async function upsertReminder(
  data: ReminderFormData,
  reminderId?: string
) {
  try {
    await requirePermission(
      "client-activity",
      reminderId ? "edit" : "create"
    )
  } catch {
    return { success: false, error: "Forbidden" }
  }

  const parsed = reminderSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data
  const session = await auth()
  if (!session?.user?.id)
    return { success: false, error: "Unauthorized" }

  const sanitized = {
    clientId: fields.clientId,
    description: fields.description,
    remindAt: fields.remindAt,
    createdBy: session.user.id,
  }

  if (reminderId) {
    const idParsed = idSchema.safeParse(reminderId)
    if (!idParsed.success)
      return { success: false, error: "Invalid reminder ID" }

    await db
      .update(remindersTable)
      .set({
        description: sanitized.description,
        remindAt: sanitized.remindAt,
      })
      .where(eq(remindersTable.id, idParsed.data))
  } else {
    await db.insert(remindersTable).values(sanitized)
  }

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function completeReminder(reminderId: string) {
  try {
    await requirePermission("client-activity", "edit")
  } catch {
    return { success: false, error: "Forbidden" }
  }

  const idParsed = idSchema.safeParse(reminderId)
  if (!idParsed.success)
    return { success: false, error: "Invalid reminder ID" }

  await db
    .update(remindersTable)
    .set({
      completed: true,
      completedAt: new Date(),
    })
    .where(eq(remindersTable.id, idParsed.data))

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function deleteReminder(reminderId: string) {
  try {
    await requirePermission("client-activity", "delete")
  } catch {
    return { success: false as const, error: "Forbidden" }
  }

  const idParsed = idSchema.safeParse(reminderId)
  if (!idParsed.success)
    return { success: false as const, error: "Invalid reminder ID" }

  await db
    .delete(remindersTable)
    .where(eq(remindersTable.id, idParsed.data))

  revalidatePath("/dashboard/clients")
  return { success: true as const }
}
