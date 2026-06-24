import { requireAuth } from '@/lib/auth'

export default async function DashboardPage() {
  await requireAuth()

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Welcome to Alsia
    </div>
  )
}
