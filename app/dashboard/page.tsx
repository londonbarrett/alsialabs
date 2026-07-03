import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  if (session?.user?.role === 'client') {
    redirect('/dashboard/profile')
  }

  redirect('/dashboard/reports')
}
