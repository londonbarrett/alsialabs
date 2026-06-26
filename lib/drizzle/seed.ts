import { db } from './client'
import { usersTable, rolesTable, userRolesTable, permissionsTable, rolePermissionsTable } from './schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

const roles = [
  { name: 'super', description: 'Full access to all features and settings' },
  { name: 'admin', description: 'Can manage clients and access most features' },
  { name: 'client', description: 'Limited access, own data only' },
]

const defaultModules = [
  { module: 'clients', actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'permissions', actions: ['manage'] },
  { module: 'users', actions: ['manage'] },
]

async function seed() {
  for (const role of roles) {
    await db.insert(rolesTable).values(role).onConflictDoNothing({ target: rolesTable.name })
  }
  console.log('Roles seeded successfully')

  const seededRoles = await db
    .select()
    .from(rolesTable)

  const superRole = seededRoles.find((r) => r.name === 'super')!
  const adminRole = seededRoles.find((r) => r.name === 'admin')!

  for (const mod of defaultModules) {
    for (const action of mod.actions) {
      await db
        .insert(permissionsTable)
        .values({ module: mod.module, action })
        .onConflictDoNothing({ target: [permissionsTable.module, permissionsTable.action] })
    }
  }
  console.log('Permissions seeded successfully')

  const allPermissions = await db.select().from(permissionsTable)

  for (const perm of allPermissions) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: superRole.id, permissionId: perm.id })
      .onConflictDoNothing()

    if (perm.module === 'clients' && perm.action !== 'delete') {
      await db
        .insert(rolePermissionsTable)
        .values({ roleId: adminRole.id, permissionId: perm.id })
        .onConflictDoNothing()
    }
  }

  console.log('Role-permissions seeded: super gets all, admin gets view/create/edit')

  const adminEmail = process.env.SUPER_USER_EMAIL
  if (adminEmail) {
    if (superRole) {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, adminEmail))
        .then((rows) => rows[0])

      if (!existing) {
        const userId = crypto.randomUUID()
        await db.insert(usersTable).values({
          id: userId,
          email: adminEmail,
        })
        await db.insert(userRolesTable).values({
          userId,
          roleId: superRole.id,
        })
        console.log(`Super user created: ${adminEmail}`)
      } else {
        console.log(`User ${adminEmail} already exists, skipping`)
      }
    }
  }

  process.exit(0)
}

seed()
