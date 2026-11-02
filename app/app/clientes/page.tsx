import { ClientListView } from "@/components/clients/clients-list-view"
import { getClients } from "@/actions/clients"
import { unwrapResponse } from "@/lib/util/unwrap"

export default async function ClientsPage() {
  const clients = await getClients()

  return <ClientListView clients={unwrapResponse(clients)} />
}
