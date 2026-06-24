import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/drizzle/client'
import { rolesTable, userRolesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

export default async function ProfilePage() {
  const session = await requireAuth()

  const roleName = await db
    .select({ name: rolesTable.name })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, session.user.id))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .then((rows) => rows[0]?.name)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <div className="flex flex-col gap-4 max-w-md">
        <div>
          <p className="text-sm text-muted-foreground">Name</p>
          <p className="text-sm font-medium">{session?.user.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="text-sm font-medium">{session?.user.email}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="text-sm font-medium capitalize">{roleName}</p>
        </div>
      </div>
    </div>
  )
}
