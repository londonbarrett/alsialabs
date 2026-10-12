"use server"

import { getEffectiveStoreId } from "@/actions/not-safe/stores"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientRemindersTable,
  clientsTable,
} from "@/lib/drizzle/schema"
import type { ClientReminder } from "@/lib/drizzle/schema"
import type {
  ReminderRecordDTO,
  ReminderFormDTO,
} from "@/actions/schemas/reminder"
import {
  ReminderFormSchema,
  ReminderRecordSchema,
} from "@/actions/schemas/reminder"
import {
  runAction,
  throwActionError,
  throwActionValidationError,
} from "@/lib/action-result"
import { and, desc, eq, sql, type SQL } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getClientReminders(clientId: string) {
  return runAction<ClientReminder[]>(async () => {
    try {
      await requirePermission("client-activity", "view")
    } catch {
      return []
    }

    const session = await auth()
    if (session?.user?.role === "user") return []

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
  })
}

export async function upsertReminder(
  data: ReminderFormDTO,
  reminderId?: string
) {
  return runAction<ClientReminder>(async () => {
    try {
      await requirePermission(
        "client-activity",
        reminderId ? "edit" : "create"
      )
    } catch {
      throwActionError("FORBIDDEN")
    }

    const parsed = ReminderFormSchema.safeParse(data)
    if (!parsed.success) {
      throwActionValidationError(parsed.error.flatten().fieldErrors)
    }

    const fields = parsed.data
    const session = await auth()
    if (!session?.user?.id) throwActionError("UNAUTHORIZED")

    const storeId = await getEffectiveStoreId()

    const sanitized = {
      clientId: fields.clientId,
      description: fields.description,
      remindAt: fields.remindAt,
      createdBy: session.user.id,
      store_id: storeId,
    }

    const conditions = reminderId
      ? [eq(clientRemindersTable.id, reminderId)]
      : []
    if (reminderId && storeId) {
      conditions.push(eq(clientRemindersTable.store_id, storeId))
    }

    const [saved] = reminderId
      ? await db
          .update(clientRemindersTable)
          .set({
            description: sanitized.description,
            remindAt: sanitized.remindAt,
          })
          .where(and(...conditions))
          .returning()
      : await db
          .insert(clientRemindersTable)
          .values(sanitized)
          .returning()

    if (!saved) throwActionError("INVALID_REMINDER_ID")

    revalidatePath("/app/clientes")
    return saved
  })
}

export async function completeReminder(reminderId: string) {
  return runAction(async () => {
    try {
      await requirePermission("client-activity", "edit")
    } catch {
      throwActionError("FORBIDDEN")
    }

    const storeId = await getEffectiveStoreId()
    const conditions = [eq(clientRemindersTable.id, reminderId)]
    if (storeId) {
      conditions.push(eq(clientRemindersTable.store_id, storeId))
    }
    await db
      .update(clientRemindersTable)
      .set({ completed: true, completedAt: new Date() })
      .where(and(...conditions))

    revalidatePath("/app/clientes")

    return { success: true }
  })
}

export async function deleteReminder(reminderId: string) {
  return runAction(async () => {
    try {
      await requirePermission("client-activity", "delete")
    } catch {
      throwActionError("FORBIDDEN")
    }

    const storeId = await getEffectiveStoreId()
    const conditions = [eq(clientRemindersTable.id, reminderId)]
    if (storeId) {
      conditions.push(eq(clientRemindersTable.store_id, storeId))
    }
    await db.delete(clientRemindersTable).where(and(...conditions))

    revalidatePath("/app/clientes")

    return { success: true }
  })
}

export async function getReminders() {
  return runAction<ReminderRecordDTO[]>(async () => {
    try {
      await requirePermission("client-activity", "view")
    } catch {
      return []
    }

    const today = new Date().toISOString().split("T")[0]

    const storeId = await getEffectiveStoreId()
    const conditions: SQL[] = []
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sql`CASE WHEN ${clientRemindersTable.remindAt} < ${today} THEN 0 ELSE 1 END`,
        desc(clientRemindersTable.remindAt)
      )
    return rows.map((r) => ReminderRecordSchema.parse(r))
  })
}
