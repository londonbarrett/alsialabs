"use server"

import { db } from "@/lib/drizzle/client"
import { storesTable } from "@/lib/drizzle/schema"
import { auth, isRetailer, requirePermission } from "@/lib/auth"
import { getActionT } from "@/lib/i18n-actions"
import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function getStores() {
  const t = await getActionT("actions.stores")
  try {
    await requirePermission("products", "view")
  } catch {
    throw new Error(t("forbidden"))
  }
  return db
    .select({
      id: storesTable.id,
      name: storesTable.name,
    })
    .from(storesTable)
}

export type StoreOption = Awaited<ReturnType<typeof getStores>>[number]

export async function getUserStores() {
  const session = await auth()
  if (!session?.user?.id) return []

  if (session.user.role === "retailer") {
    return db
      .select({
        id: storesTable.id,
        name: storesTable.name,
      })
      .from(storesTable)
      .where(eq(storesTable.owner_id, session.user.id))
  }

  return db
    .select({
      id: storesTable.id,
      name: storesTable.name,
    })
    .from(storesTable)
}

export type UserStore = Awaited<
  ReturnType<typeof getUserStores>
>[number]

export async function switchStore(storeId: string | null) {
  const session = await auth()
  if (!session?.user?.id) return

  if (storeId === null) {
    const c = await cookies()
    c.delete("store_id")
  } else {
    const c = await cookies()
    c.set("store_id", storeId, {
      path: "/dashboard",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  revalidatePath("/dashboard", "layout")
}

export async function getScopedStoreId(): Promise<string | null> {
  try {
    const c = await cookies()
    return c.get("store_id")?.value ?? null
  } catch {
    return null
  }
}

export async function getEffectiveStoreId(): Promise<string | null> {
  const cookie = await getScopedStoreId()
  if (cookie) return cookie

  const session = await auth()
  if (!session?.user?.id) return null

  if (isRetailer({ user: { role: session.user.role ?? null } })) {
    let [store] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.owner_id, session.user.id))
      .limit(1)

    if (!store) {
      const displayName =
        session.user.name || session.user.email || "Store"
      ;[store] = await db
        .insert(storesTable)
        .values({
          name: `${displayName}'s Store`,
          owner_id: session.user.id,
        })
        .returning({ id: storesTable.id })
    }

    return store.id
  }

  return null
}
