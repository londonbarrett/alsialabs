import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { requireAuth, getCachedUserPermissions } from "@/lib/auth"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  const permissions = session.user?.id
    ? await getCachedUserPermissions(session.user.id)
    : []

  return (
    <SidebarProvider>
      <AppSidebar
        permissions={permissions}
        role={session.user?.role}
        user={{
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
          image: session.user?.image ?? null,
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <DashboardBreadcrumb />
        </header>
        <section className="flex flex-1 flex-col">{children}</section>
      </SidebarInset>
    </SidebarProvider>
  )
}
