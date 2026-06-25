import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { requireAuth } from '@/lib/auth'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">Dashboard</span>
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
