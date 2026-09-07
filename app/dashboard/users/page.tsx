import { auth, isSuperUser } from "@/lib/auth"
import { forbidden } from "next/navigation"
import { db } from "@/lib/drizzle/client"
import { rolesTable } from "@/lib/drizzle/schema"
import { getUsers } from "@/lib/actions/users"
import { UsersTable } from "@/components/users/users-table"
import { unwrapResponse } from "@/lib/util/unwrap"

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const result = await getUsers()
  if (result.serverError) forbidden()

  const users = unwrapResponse(result)

  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name })
    .from(rolesTable)

  return (
    <UsersTable
      users={users}
      roles={roles}
      currentUserId={session.user.id}
    />
  )
}
