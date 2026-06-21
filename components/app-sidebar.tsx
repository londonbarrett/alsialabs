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
import {
  User,
  Settings,
  LayoutDashboard,
  FolderKanban,
  Calendar,
  BarChart3,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import menuConfig from '@/config/sidebar-menu.json'
import { ThemeToggle } from '@/components/theme-toggle'

type MenuArea = keyof typeof menuConfig
type MenuSections = {
  [K in MenuArea]: {
    label: string
    items: { label: string; icon: string; url: string }[]
  }
}

const iconMap: Record<string, LucideIcon> = {
  User,
  Settings,
  LayoutDashboard,
  FolderKanban,
  Calendar,
  BarChart3,
  LifeBuoy,
  MessageSquare,
}

export function AppSidebar() {
  const sections = menuConfig as MenuSections
  const [activeItem, setActiveItem] = useState<string | null>(null)

  const handleClick = useCallback((label: string, e: React.MouseEvent) => {
    e.preventDefault()
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
        {(Object.keys(sections) as MenuArea[]).map((area) => (
          <SidebarGroup key={area}>
            <SidebarGroupLabel>{sections[area].label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections[area].items.map((item) => {
                  const Icon = iconMap[item.icon] || LayoutDashboard
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={activeItem === item.label}>
                        <a href={item.url} onClick={(e) => handleClick(item.label, e)}>
                          <Icon />
                          <span>{item.label}</span>
                        </a>
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
