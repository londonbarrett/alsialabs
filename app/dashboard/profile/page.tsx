import { auth, hasPermission } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/drizzle/client"
import { clientsTable } from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"
import { getClientInvoices } from "@/lib/actions/client-invoices"
import { InvoiceHistory } from "@/components/clients/invoice-history"

export default async function ProfilePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const client = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.userId, session.user.id))
    .then((rows) => rows[0])

  const canViewInvoices = session.user.id
    ? await hasPermission(
        session.user.id,
        "sales",
        "view-invoice-history"
      )
    : false

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

      {client && canViewInvoices && (
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Invoice History
          </h2>
          <InvoiceHistoryComponent clientId={client.id} />
        </section>
      )}
    </div>
  )
}

async function InvoiceHistoryComponent({
  clientId,
}: {
  clientId: string
}) {
  const result = await getClientInvoices(clientId)
  const invoices = result.success ? result.data : []

  return <InvoiceHistory invoices={invoices} />
}
