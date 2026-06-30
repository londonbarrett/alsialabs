'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getSidebarMenu, type SidebarItem } from '@/config/sidebar-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

export function AppSidebar({ permissions = [], role }: { permissions?: string[]; role?: string | null }) {
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
                {section.label === 'Auxiliary' && (
                  <SidebarMenuItem>
                    <ThemeToggle />
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
