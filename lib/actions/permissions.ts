'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { permissionsTable, rolePermissionsTable, rolesTable } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { auth, isSuperUser } from '@/lib/auth'
import { z } from 'zod'

export type PermissionMatrixItem = {
  id: string
  module: string
  action: string
  roleIds: string[]
}

export async function getPermissions() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const allPermissions = await db
    .select({
      id: permissionsTable.id,
      module: permissionsTable.module,
      action: permissionsTable.action,
    })
    .from(permissionsTable)

  const allRolePermissions = await db
    .select({
      permissionId: rolePermissionsTable.permissionId,
      roleId: rolePermissionsTable.roleId,
    })
    .from(rolePermissionsTable)

  const rolePermMap = new Map<string, string[]>()
  for (const rp of allRolePermissions) {
    const existing = rolePermMap.get(rp.permissionId) ?? []
    existing.push(rp.roleId)
    rolePermMap.set(rp.permissionId, existing)
  }

  const matrix: PermissionMatrixItem[] = allPermissions.map((p) => ({
    ...p,
    roleIds: rolePermMap.get(p.id) ?? [],
  }))

  const allRoles = await db
    .select({ id: rolesTable.id, name: rolesTable.name })
    .from(rolesTable)

  return { success: true as const, matrix, roles: allRoles }
}

const manageModuleSchema = z.object({
  action: z.enum(['create', 'delete']),
  name: z.string().min(1).transform((v) => v.trim().toLowerCase()),
  actions: z.array(z.string().min(1)).optional(),
})

export async function manageModule(data: z.infer<typeof manageModuleSchema>) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const parsed = manageModuleSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: 'Validation failed' }
  }

  const { action, name, actions } = parsed.data

  if (action === 'create') {
    if (!actions || actions.length === 0) {
      return { success: false as const, error: 'At least one action is required' }
    }

    for (const act of actions) {
      await db.insert(permissionsTable).values({ module: name, action: act }).onConflictDoNothing()
    }
  } else if (action === 'delete') {
    await db.delete(permissionsTable).where(eq(permissionsTable.module, name))
  }

  revalidatePath('/dashboard/permissions')
  updateTag('permissions')
  return { success: true as const }
}

const toggleSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
  enabled: z.boolean(),
})

export async function togglePermission(data: z.infer<typeof toggleSchema>) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const parsed = toggleSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: 'Validation failed' }
  }

  const { roleId, permissionId, enabled } = parsed.data

  if (enabled) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId, permissionId })
      .onConflictDoNothing()
  } else {
    await db
      .delete(rolePermissionsTable)
      .where(
        and(
          eq(rolePermissionsTable.roleId, roleId),
          eq(rolePermissionsTable.permissionId, permissionId),
        ),
      )
  }

  revalidatePath('/dashboard/permissions')
  updateTag('permissions')
  return { success: true as const }
}
