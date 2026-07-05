import { auth, getUserPermissions } from "@/lib/auth"
import type { Activity, Reminder } from "@/lib/drizzle/schema"
import { forbidden } from "next/navigation"
import { db } from "@/lib/drizzle/client"
import { clientsTable } from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"
import { getClientInvoices } from "@/lib/actions/client-invoices"
import { getActivities } from "@/lib/actions/activities"
import { getReminders } from "@/lib/actions/reminders"
import { InvoiceHistory } from "@/components/clients/invoice-history"
import { ActivityTimeline } from "@/components/clients/activity-timeline"

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user?.id) {
    forbidden()
  }

  const client = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId))
    .then((rows) => rows[0])

  if (!client) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Client Not Found
        </h1>
        <p className="text-muted-foreground">
          The requested client does not exist.
        </p>
      </div>
    )
  }

  const permissions = await getUserPermissions(session.user.id)

  const canViewActivities = permissions.includes("client-activity:view")

  const invoices = canViewActivities
    ? await getClientInvoices(clientId)
    : null
  const invoiceData = invoices?.success ? invoices.data : []

  const [activities, reminders] = canViewActivities
    ? await Promise.all([
        getActivities(clientId),
        getReminders(clientId),
      ])
    : [[], []]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {client.name}
      </h1>
      <div className="max-w-lg rounded-md border p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-base font-medium">{client.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="text-base font-medium">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base font-medium">
              {client.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="text-base font-medium">
              {client.location ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Comments</p>
            <p className="text-base font-medium">
              {client.comments ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {canViewActivities && (
        <ActivityTimeline
          clientId={clientId}
          activities={activities as Activity[]}
          reminders={reminders as Reminder[]}
          permissions={permissions}
        />
      )}

      {canViewActivities && <InvoiceHistory invoices={invoiceData} />}
    </div>
  )
}
