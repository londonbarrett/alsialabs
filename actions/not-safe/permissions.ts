"use server"

import { runAction, throwActionError } from "@/lib/action-result"
import { auth, isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
} from "@/lib/drizzle/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath, updateTag } from "next/cache"

import type {
  ManageModuleDTO,
  PermissionMatrixItemDTO,
  TogglePermissionDTO,
} from "@/actions/schemas/permission"
import {
  ManageModuleSchema,
  PermissionMatrixItemSchema,
  TogglePermissionSchema,
} from "@/actions/schemas/permission"

export async function getPermissions() {
  return runAction<{
    matrix: PermissionMatrixItemDTO[]
    roles: { id: string; name: string }[]
  }>(async () => {
    const session = await auth()
    if (!session?.user || !isSuperUser(session)) {
      throwActionError("FORBIDDEN")
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

    const matrix: PermissionMatrixItemDTO[] = allPermissions
      .map((p) => ({
        ...p,
        roleIds: rolePermMap.get(p.id) ?? [],
      }))
      .map((m) => PermissionMatrixItemSchema.parse(m))

    const allRoles = await db
      .select({ id: rolesTable.id, name: rolesTable.name })
      .from(rolesTable)

    return { matrix, roles: allRoles }
  })
}

export async function manageModule(data: ManageModuleDTO) {
  return runAction(async () => {
    const session = await auth()
    if (!session?.user || !isSuperUser(session)) {
      throwActionError("FORBIDDEN")
    }

    const parsed = ManageModuleSchema.safeParse(data)
    if (!parsed.success) {
      throwActionError("VALIDATION_FAILED")
    }

    const { action, name, actions } = parsed.data

    if (action === "create") {
      if (!actions || actions.length === 0) {
        throwActionError("ACTION_REQUIRED")
      }

      for (const act of actions) {
        await db
          .insert(permissionsTable)
          .values({ module: name, action: act })
          .onConflictDoNothing()
      }
    } else if (action === "delete") {
      await db
        .delete(permissionsTable)
        .where(eq(permissionsTable.module, name))
    }

    revalidatePath("/app/permisos")
    updateTag("permissions")

    return { success: true }
  })
}

export async function togglePermission(data: TogglePermissionDTO) {
  return runAction(async () => {
    const session = await auth()
    if (!session?.user || !isSuperUser(session)) {
      throwActionError("FORBIDDEN")
    }

    const parsed = TogglePermissionSchema.safeParse(data)
    if (!parsed.success) {
      throwActionError("VALIDATION_FAILED")
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
            eq(rolePermissionsTable.permissionId, permissionId)
          )
        )
    }

    revalidatePath("/app/permisos")
    updateTag("permissions")

    return { success: true }
  })
}
