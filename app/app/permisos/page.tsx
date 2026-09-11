import { getTranslations } from 'next-intl/server'
import { auth, isSuperUser } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getPermissions } from '@/lib/actions/permissions'
import { PermissionMatrix } from '@/components/permission-matrix'

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const result = await getPermissions()
  const t = await getTranslations('permissions')
  if (!result.success) return <div>{t('failedToLoad')}</div>

  return (
    <PermissionMatrix
      matrix={result.matrix}
      roles={result.roles}
    />
  )
}
