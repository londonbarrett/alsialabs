import { ClientListView } from "@/components/clients/clients-list-view"
import { getClients } from "@/lib/actions/clients"
import { auth, getUserPermissions } from "@/lib/auth"
import { unwrapArray } from "@/lib/util/unwrap"

export default async function ClientsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const [clientsResult, permissions] = await Promise.all([
    getClients(),
    getUserPermissions(session.user.id),
  ])

  return (
    <ClientListView
      clients={unwrapArray(clientsResult)}
      permissions={permissions}
    />
  )
}
