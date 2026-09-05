import { Page } from "@/components/common/page"
import { PageHeader } from "@/components/common/page-header"
import { MyInvoicesView } from "@/components/my-invoices/my-invoices-view"
import { getMyInvoices } from "@/lib/actions/invoices"
import { auth } from "@/lib/auth"
import { Receipt } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function MyInvoicesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("myInvoices")
  const invoicesPromise = getMyInvoices()

  return (
    <Page
      header={
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          icon={Receipt}
        />
      }
      fallback={
        <div className="h-96 animate-pulse rounded-xl border bg-muted/30" />
      }
    >
      <MyInvoicesView invoicesPromise={invoicesPromise} />
    </Page>
  )
}
