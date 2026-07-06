import { auth, getUserPermissions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getClientByUserId } from "@/lib/actions/clients"
import { getClientInvoices } from "@/lib/actions/client-invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import { ActivityTimeline } from "@/components/clients/activity-timeline"

export default async function ProfilePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const client = await getClientByUserId(session.user.id)

  const permissions = await getUserPermissions(session.user.id)
  const canView = permissions.includes("client-activity:view")

  let invoices: Invoice[] = []
  if (client && canView) {
    const result = await getClientInvoices(client.id)
    if (result.success) {
      invoices = result.data as Invoice[]
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        My Profile
      </h1>
      <div className="max-w-lg rounded-md border p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-base font-medium">
              {session.user.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base font-medium">
              {session.user.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="text-base font-medium capitalize">
              {session.user.role ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {client && canView && (
        <ActivityTimeline
          clientId={client.id}
          activities={[]}
          reminders={[]}
          invoices={invoices}
          permissions={permissions}
        />
      )}
    </div>
  )
}
