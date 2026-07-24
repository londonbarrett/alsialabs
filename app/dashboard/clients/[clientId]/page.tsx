import { ActivityTimeline } from "@/components/clients/activity-timeline"
import { ClientInfoCard } from "@/components/clients/client-info-card"
import { ClientSwitcher } from "@/components/clients/client-switcher"
import { PageHeader } from "@/components/common/page-header"
import { getActivities } from "@/lib/actions/activities"
import { getClientByClientId } from "@/lib/actions/clients"
import { getClientInvoices } from "@/lib/actions/invoices"
import { getReminders } from "@/lib/actions/reminders"
import { auth, getUserPermissions } from "@/lib/auth"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
} from "@/lib/drizzle/schema"
import { Users } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { forbidden } from "next/navigation"

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const session = await auth()
  const t = await getTranslations()

  if (!session?.user?.id) {
    forbidden()
  }

  const client = await getClientByClientId(clientId)

  if (!client) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("clients.clientNotFound")}
        </h1>
        <p className="text-muted-foreground">
          {t("clients.clientNotFoundDesc")}
        </p>
      </div>
    )
  }

  const permissions = await getUserPermissions(session.user.id)

  const canView = permissions.includes("client-activity:view")
  const isUser = session.user.role === "user"

  let invoices: Invoice[] = []
  let activities: ClientActivity[] = []
  let reminders: ClientReminder[] = []

  if (canView) {
    const result = await getClientInvoices(clientId)
    if (result.success) {
      invoices = result.data as Invoice[]
    }

    if (!isUser) {
      ;[activities, reminders] = await Promise.all([
        getActivities(clientId),
        getReminders(clientId),
      ])
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader title={client.name} icon={Users}>
        <ClientSwitcher />
      </PageHeader>
      <ClientInfoCard client={client} />

      {canView && (
        <ActivityTimeline
          clientId={clientId}
          activities={activities}
          reminders={reminders}
          invoices={invoices}
          permissions={permissions}
        />
      )}
    </div>
  )
}
