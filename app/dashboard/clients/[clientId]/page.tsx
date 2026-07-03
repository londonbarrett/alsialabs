import { auth, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getClientInvoices } from '@/lib/actions/client-invoices'
import { InvoiceHistory } from '@/components/clients/invoice-history'

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user?.id) {
    forbidden()
  }

  const client = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId))
    .then((rows) => rows[0])

  if (!client) {
    return (
      <div className="flex flex-col p-6 gap-6 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">Client Not Found</h1>
        <p className="text-muted-foreground">The requested client does not exist.</p>
      </div>
    )
  }

  const canViewInvoices = await hasPermission(session.user.id, 'sales', 'view-invoice-history')
  const invoices = canViewInvoices ? await getClientInvoices(clientId) : null
  const invoiceData = invoices?.success ? invoices.data : []

  return (
    <div className="flex flex-col p-6 gap-6 flex-1">
      <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
      <div className="rounded-md border p-6 max-w-lg">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-base font-medium">{client.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="text-base font-medium">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base font-medium">{client.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="text-base font-medium">{client.location ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Comments</p>
            <p className="text-base font-medium">{client.comments ?? '—'}</p>
          </div>
        </div>
      </div>

      {canViewInvoices && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight mb-4">Invoice History</h2>
          <InvoiceHistory invoices={invoiceData} />
        </section>
      )}
    </div>
  )
}
