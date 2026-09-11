import { ActivityTimeline } from "@/components/clients/activity-timeline"
import { getClientByUserId } from "@/lib/actions/clients"
import {
  getClientInvoices,
  getClientPayments,
  getMyInvoices,
  getMyPayments,
} from "@/lib/actions/invoices"
import { auth, getUserPermissions } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import type {
  Client,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import { clientsTable } from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const session = await auth()
  const t = await getTranslations("profile")

  if (!session?.user) {
    redirect("/login")
  }

  const isUser = session.user.role === "user"
  const permissions = await getUserPermissions(session.user.id)
  const canView = permissions.includes("client-activity:view")

  let client: Client | null = null
  let invoices: Invoice[] = []
  let payments: Array<InvoicePayment & { invoiceNumber: string }> = []

  if (isUser) {
    const [myInvoicesResult, myPaymentsResult] = await Promise.all([getMyInvoices(), getMyPayments()])
    const myData = myInvoicesResult.data
    if (myData?.clientId) {
      const rows = await db
        .select()
        .from(clientsTable)
        .where(eq(clientsTable.id, myData.clientId))
      client = (rows[0] as Client | undefined) ?? null
      invoices = (myData.invoices as Invoice[]) ?? []
      payments =
        (myPaymentsResult.data as Array<
          InvoicePayment & { invoiceNumber: string }
        >) ?? []
    }
  } else {
    const clientResult = await getClientByUserId({
      userId: session.user.id,
    })
    client = (clientResult.data as Client | null) ?? null

    if (client && canView) {
      const [invoiceResult, paymentResult] = await Promise.all([
        getClientInvoices({ clientId: client.id }),
        getClientPayments({ clientId: client.id }),
      ])
      if (invoiceResult.data) {
        invoices = invoiceResult.data as Invoice[]
      }
      if (paymentResult.data) {
        payments = paymentResult.data
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <div className="max-w-lg rounded-md border p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("name")}</p>
            <p className="text-base font-medium">
              {session.user.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("email")}
            </p>
            <p className="text-base font-medium">
              {session.user.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("role")}</p>
            <p className="text-base font-medium capitalize">
              {session.user.role ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {client && (canView || isUser) && (
        <ActivityTimeline
          clientId={client.id}
          activities={[]}
          reminders={[]}
          invoices={invoices}
          payments={payments}
          permissions={permissions}
        />
      )}
    </div>
  )
}
