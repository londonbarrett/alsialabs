'use client'

import { useState, useCallback } from 'react'
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
import { sidebarMenu, type SidebarItem } from '@/config/sidebar-menu'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

type MenuArea = keyof typeof sidebarMenu

export function AppSidebar() {
  const [activeItem, setActiveItem] = useState<string | null>(null)

  const handleClick = useCallback((label: string) => {
    setActiveItem(label)
  }, [])

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
        {(Object.keys(sidebarMenu) as MenuArea[]).map((area) => (
          <SidebarGroup key={area}>
            <SidebarGroupLabel>{sidebarMenu[area].label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarMenu[area].items.map((item: SidebarItem) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={activeItem === item.label}>
                        <Link href={item.url} onClick={() => handleClick(item.label)}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
                {area === 'auxiliary' && (
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
