import { AppSidebar } from "@/components/app-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getScopedStoreId } from "@/lib/actions/stores"
import { getCachedUserPermissions, requireAuth } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  const permissions = session.user?.id
    ? await getCachedUserPermissions(session.user.id)
    : []
  const selectedStoreId = await getScopedStoreId()

  return (
    <SidebarProvider>
      <AppSidebar
        permissions={permissions}
        role={session.user?.role}
        selectedStoreId={selectedStoreId}
        user={{
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
          image: session.user?.image ?? null,
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 z-1 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <DashboardBreadcrumb />
        </header>
        <section className="flex flex-1 flex-col">{children}</section>
      </SidebarInset>
    </SidebarProvider>
  )
}
