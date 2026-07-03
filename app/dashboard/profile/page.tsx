import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col p-6 gap-6 flex-1">
      <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
      <div className="rounded-md border p-6 max-w-lg">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-base font-medium">{session.user.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base font-medium">{session.user.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="text-base font-medium capitalize">{session.user.role ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
