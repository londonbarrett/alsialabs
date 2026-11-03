import { BackupsProvider } from "@/components/backups/backups-provider"
import { BackupsView } from "@/components/backups/backups-view"
import { listBackups } from "@/lib/backup/files"
import { listPublicTables } from "@/lib/backup/tables"
import { auth, isSuperUser } from "@/lib/auth"
import { forbidden } from "next/navigation"

export default async function BackupsPage() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) forbidden()

  const tables = await listPublicTables()
  const backups = await listBackups()

  return (
    <BackupsProvider backups={backups}>
      <BackupsView tables={tables} />
    </BackupsProvider>
  )
}
