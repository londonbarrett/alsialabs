import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { ClientListView } from '@/components/clients/clients-list-view'

export default async function ClientsPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'clients', 'view'))) {
    forbidden()
  }

  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
      location: clientsTable.location,
      comments: clientsTable.comments,
      email: clientsTable.email,
      userId: clientsTable.userId,
    })
    .from(clientsTable)

  const permissions = await getUserPermissions(session.user.id)

  return <ClientListView clients={clients} permissions={permissions} />
}
