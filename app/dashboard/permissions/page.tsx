import { auth, isSuperUser } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getPermissions } from '@/lib/actions/permissions'
import { PermissionMatrix } from '@/components/permission-matrix'

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const result = await getPermissions()
  if (!result.success) return <div>Failed to load permissions</div>

  return (
    <PermissionMatrix
      matrix={result.matrix}
      roles={result.roles}
    />
  )
}
