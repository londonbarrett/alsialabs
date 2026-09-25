import { ActivityTimeline } from "@/components/clients/activity-timeline"
import { ClientInfoCard } from "@/components/clients/client-info-card"
import { ClientSwitcher } from "@/components/clients/client-switcher"
import { PageHeader } from "@/components/common/page-header"
import { getClientActivities } from "@/lib/actions/activities"
import { getClientByClientId } from "@/lib/actions/clients"
import {
  getClientInvoices,
  getClientPayments,
} from "@/lib/actions/invoices"
import { getClientReminders } from "@/lib/actions/reminders"
import { auth, hasPermission } from "@/lib/auth"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
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

  const clientResult = await getClientByClientId({ id: clientId })
  const client = clientResult.data

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

  const canView = await hasPermission(
    session.user.id,
    "client-activity",
    "view"
  )

  let invoices: Invoice[] = []
  let activities: ClientActivity[] = []
  let reminders: ClientReminder[] = []
  let payments: Array<InvoicePayment & { invoiceNumber: string }> = []

  if (canView) {
    const [
      invoiceResult,
      paymentResult,
      clientActivities,
      clientReminders,
    ] = await Promise.all([
      getClientInvoices({ clientId }),
      getClientPayments({ clientId }),
      getClientActivities(clientId),
      getClientReminders(clientId),
    ])
    if (invoiceResult.data) {
      invoices = invoiceResult.data as Invoice[]
    }
    if (paymentResult.data) {
      payments = paymentResult.data
    }
    activities = clientActivities
    reminders = clientReminders
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
          payments={payments}
        />
      )}
    </div>
  )
}
