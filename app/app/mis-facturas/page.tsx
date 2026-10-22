import { Page } from "@/components/common/page"
import { PageHeader } from "@/components/common/page-header"
import { MyInvoicesView } from "@/components/my-invoices/my-invoices-view"
import { MyInvoicesProvider } from "@/components/my-invoices/my-invoices-provider"
import { getMyInvoices } from "@/actions/invoices"
import { getProjects } from "@/actions/projects"
import { auth } from "@/lib/auth"
import { unwrapResponse } from "@/lib/util/unwrap"
import { Receipt } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

async function MyInvoicesContent() {
  const [myResult, projectsResult] = await Promise.all([
    getMyInvoices(),
    getProjects(),
  ])
  const seed = {
    ...unwrapResponse(myResult, { clientId: null, invoices: [] }),
    projects: unwrapResponse(projectsResult, []),
  }
  return (
    <MyInvoicesProvider seed={seed}>
      <MyInvoicesView />
    </MyInvoicesProvider>
  )
}

export default async function MyInvoicesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations()

  return (
    <Page
      header={
        <PageHeader
          title={t("nav.mis-facturas")}
          subtitle={t("myInvoices.subtitle")}
          icon={Receipt}
        />
      }
      fallback={
        <div className="h-96 animate-pulse rounded-xl border bg-muted/30" />
      }
    >
      <MyInvoicesContent />
    </Page>
  )
}
