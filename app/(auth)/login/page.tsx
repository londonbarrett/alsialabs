import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/app')
  }

  const t = await getTranslations('common')

  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><p className="text-sm text-muted-foreground">{t('loading')}</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
