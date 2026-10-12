"use server"

import { getEffectiveStoreId } from "@/actions/not-safe/stores"
import {
  type ActivityFormDTO,
  ActivityFormSchema,
  type ClientActivityRecordDTO,
  ClientActivityRecordSchema,
} from "@/actions/schemas/activity"
import {
  runAction,
  throwActionError,
  throwActionValidationError,
} from "@/lib/action-result"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import { clientActivitiesTable } from "@/lib/drizzle/schema"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getClientActivities(clientId: string) {
  return runAction<ClientActivityRecordDTO[]>(async () => {
    try {
      await requirePermission("client-activity", "view")
    } catch {
      return []
    }

    const session = await auth()
    if (session?.user?.role === "user") return []

    const rows = await db
      .select()
      .from(clientActivitiesTable)
      .where(eq(clientActivitiesTable.clientId, clientId))
      .orderBy(desc(clientActivitiesTable.activityDate))
    return rows.map((r) => ClientActivityRecordSchema.parse(r))
  })
}

export async function upsertActivity(
  data: ActivityFormDTO,
  activityId?: string
) {
  return runAction<ClientActivityRecordDTO>(async () => {
    try {
      await requirePermission(
        "client-activity",
        activityId ? "edit" : "create"
      )
    } catch {
      throwActionError("FORBIDDEN")
    }

    const parsed = ActivityFormSchema.safeParse(data)
    if (!parsed.success) {
      throwActionValidationError(parsed.error.flatten().fieldErrors)
    }

    const fields = parsed.data
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) throwActionError("UNAUTHORIZED")

    const storeId = await getEffectiveStoreId()

    const sanitized = {
      clientId: fields.clientId,
      type: fields.type,
      subject: fields.subject,
      description: fields.description || null,
      activityDate: fields.activityDate,
      performedBy: userId,
      store_id: storeId,
    }

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
      if (!updated) throwActionError("INVALID_ACTIVITY_ID")

      revalidatePath("/app/clientes")
      revalidatePath("/app/actividad")
      return ClientActivityRecordSchema.parse(updated)
    }

    const [inserted] = await db
      .insert(clientActivitiesTable)
      .values(sanitized)
      .returning()
    if (!inserted) throwActionError("VALIDATION_FAILED")

    revalidatePath("/app/clientes")
    revalidatePath("/app/actividad")
    return ClientActivityRecordSchema.parse(inserted)
  })
}

export async function deleteActivity(activityId: string) {
  return runAction(async () => {
    try {
      await requirePermission("client-activity", "delete")
    } catch {
      throwActionError("FORBIDDEN")
    }

    const storeId = await getEffectiveStoreId()
    const conditions = [eq(clientActivitiesTable.id, activityId)]
    if (storeId) {
      conditions.push(eq(clientActivitiesTable.store_id, storeId))
    }
    await db.delete(clientActivitiesTable).where(and(...conditions))

    revalidatePath("/app/clientes")
    revalidatePath("/app/actividad")

    return { success: true }
  })
}
