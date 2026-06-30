import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { requireAuth, getUserPermissions } from '@/lib/auth'
import { SignOutButton } from '@/components/sign-out-button'
import { DashboardBreadcrumb } from '@/components/dashboard-breadcrumb'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()

  const permissions = session.user?.id ? await getUserPermissions(session.user.id) : []

  return (
    <SidebarProvider>
      <AppSidebar permissions={permissions} />
      <SidebarInset>
        <header className="sticky top-0 bg-background flex h-12 shrink-0 items-center gap-2 border-b px-4 z-500">
          <SidebarTrigger />
          <DashboardBreadcrumb />
          <div className="ml-auto">
            <SignOutButton />
          </div>
        </header>
        <section className="flex flex-col flex-1">
          {children}
        </section>
      </SidebarInset>
    </SidebarProvider>
  )
}
