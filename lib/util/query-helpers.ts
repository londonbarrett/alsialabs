import { db } from "@/lib/drizzle/client"
import { rolesTable } from "@/lib/drizzle/schema"
import { eq, type Column, type SQL } from "drizzle-orm"

export function buildStoreCondition(
  table: { store_id: Column },
  storeId?: string | null
): SQL | undefined {
  if (!storeId) return undefined
  return eq(table.store_id, storeId)
}

const roleCache = new Map<string, string>()

export async function getRoleIdByName(
  name: string
): Promise<string | null> {
  const cached = roleCache.get(name)
  if (cached) return cached

  const role = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, name))
    .then((rows) => rows[0])

  if (role) {
    roleCache.set(name, role.id)
    return role.id
  }

  return null
}

export function clearRoleCache() {
  roleCache.clear()
}
