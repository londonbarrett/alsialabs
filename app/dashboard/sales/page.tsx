import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { getInvoices, getInvoiceProducts } from '@/lib/actions/sales'
import { SalesListView } from '@/components/sales/sales-list-view'

export default async function SalesPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'sales', 'view'))) {
    forbidden()
  }

  const [invoices, clients, products, permissions] = await Promise.all([
    getInvoices(),
    db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
    getInvoiceProducts(),
    getUserPermissions(session.user.id),
  ])

  return <SalesListView invoices={invoices} clients={clients} products={products} permissions={permissions} />
}
