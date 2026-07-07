import { getTranslations } from 'next-intl/server'
import { ClientSwitcher } from "@/components/clients/client-switcher"
import { ActivityTimeline } from "@/components/clients/activity-timeline"
import { getActivities } from "@/lib/actions/activities"
import { getClientInvoices } from "@/lib/actions/client-invoices"
import { getClientByClientId, getClients } from "@/lib/actions/clients"
import { getReminders } from "@/lib/actions/reminders"
import { auth, getUserPermissions } from "@/lib/auth"
import type { Activity, Invoice, Reminder } from "@/lib/drizzle/schema"
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
          {t('clients.clientNotFound')}
        </h1>
        <p className="text-muted-foreground">
          {t('clients.clientNotFoundDesc')}
        </p>
      </div>
    )
  }

  const permissions = await getUserPermissions(session.user.id)

  const canView = permissions.includes("client-activity:view")
  const isClient = session.user.role === "client"

  let invoices: Invoice[] = []
  let activities: Activity[] = []
  let reminders: Reminder[] = []

  if (canView) {
    const result = await getClientInvoices(clientId)
    if (result.success) {
      invoices = result.data as Invoice[]
    }

    if (!isClient) {
      ;[activities, reminders] = await Promise.all([
        getActivities(clientId),
        getReminders(clientId),
      ])
    }
  }

  const allClients = await getClients()

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <ClientSwitcher
          clients={allClients}
          currentClientId={clientId}
        />
      </div>
      <div className="max-w-lg rounded-md border p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('common.name')}</p>
            <p className="text-base font-medium">{client.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('clients.phone')}</p>
            <p className="text-base font-medium">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('clients.email')}</p>
            <p className="text-base font-medium">
              {client.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('clients.location')}</p>
            <p className="text-base font-medium">
              {client.location ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('clients.comments')}</p>
            <p className="text-base font-medium">
              {client.comments ?? "—"}
            </p>
          </div>
        </div>
      </div>

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
