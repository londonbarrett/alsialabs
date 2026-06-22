import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
