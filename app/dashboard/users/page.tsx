import { auth, isSuperUser } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { db } from '@/lib/drizzle/client'
import { usersTable, userRolesTable, rolesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { UsersTable } from '@/components/users-table'

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: userRolesTable.roleId,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(usersTable.id, userRolesTable.userId))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))

  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name })
    .from(rolesTable)

  return <UsersTable users={users} roles={roles} currentUserId={session.user.id} />
}
