import { db } from './client'
import { usersTable, rolesTable, userRolesTable } from './schema'
import { eq } from 'drizzle-orm'

const roles = [
  { name: 'super', description: 'Full access to all features and settings' },
  { name: 'admin', description: 'Can manage clients and access most features' },
  { name: 'client', description: 'Limited access, own data only' },
]

async function seed() {
  for (const role of roles) {
    await db.insert(rolesTable).values(role).onConflictDoNothing({ target: rolesTable.name })
  }
  console.log('Roles seeded successfully')

  const adminEmail = process.env.SUPER_USER_EMAIL
  if (adminEmail) {
    const superRole = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, 'super'))
      .then((rows) => rows[0])

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
