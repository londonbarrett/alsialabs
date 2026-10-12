import { getTranslations } from "next-intl/server"
import { auth, isSuperUser } from "@/lib/auth"
import { forbidden } from "next/navigation"
import { getPermissions } from "@/actions/not-safe/permissions"
import { PermissionMatrix } from "@/components/permission-matrix"

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const result = await getPermissions()
  const t = await getTranslations("permissions")
  if (!result.data) return <div>{t("failedToLoad")}</div>

  return (
    <PermissionMatrix matrix={result.data.matrix} roles={result.data.roles} />
  )
}
