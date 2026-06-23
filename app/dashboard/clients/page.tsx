import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { ClientListView } from '@/components/client-list-view'

export default async function ClientsPage() {
  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
      location: clientsTable.location,
      comments: clientsTable.comments,
      email: clientsTable.email,
    })
    .from(clientsTable)

  return <ClientListView clients={clients} />
}
