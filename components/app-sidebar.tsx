'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { NavUser } from '@/components/nav-user'
import { getSidebarMenu, type SidebarItem } from '@/config/sidebar-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AppSidebar({
  permissions = [],
  role,
  user,
}: {
  permissions?: string[]
  role?: string | null
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
}) {
  const pathname = usePathname()

  const sidebarMenu = getSidebarMenu(role, permissions)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pt-4">
        <span className="text-lg font-semibold tracking-tight px-2 group-data-[collapsible=icon]:hidden">
          Alsia
        </span>
        <span className="hidden group-data-[collapsible=icon]:block text-lg font-semibold">
          A
        </span>
      </SidebarHeader>
      <SidebarContent>
        {sidebarMenu.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item: SidebarItem) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={pathname === item.url}>
                        <Link href={item.url}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
