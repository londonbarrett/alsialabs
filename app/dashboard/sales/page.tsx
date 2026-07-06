import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getInvoices } from '@/lib/actions/sales'
import { SalesListView } from '@/components/sales/sales-list-view'

export default async function SalesPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'sales', 'view'))) {
    forbidden()
  }

  const [invoices, permissions] = await Promise.all([
    getInvoices(),
    getUserPermissions(session.user.id),
  ])

  return <SalesListView invoices={invoices} permissions={permissions} />
}
