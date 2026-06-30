import { auth, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getMonthlyRevenue, getTopClientsByRevenue } from '@/lib/actions/reports'
import { ReportsView } from '@/components/reports/reports-view'

export default async function ReportsPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'reports', 'view'))) {
    forbidden()
  }

  const [monthlyRevenue, topClients] = await Promise.all([
    getMonthlyRevenue(),
    getTopClientsByRevenue(10),
  ])

  return <ReportsView monthlyRevenue={monthlyRevenue} topClients={topClients} />
}
