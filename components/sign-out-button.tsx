'use client'

import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  const { data: session } = useSession()

  if (!session?.user) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => signOut({ redirectTo: '/login' })}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
}
