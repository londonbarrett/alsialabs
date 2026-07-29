"use client"

import { Logo } from "@/components/common/alsia-logo"
import { LogoSmall } from "@/components/common/alsia-logo-small"
import { NavUser } from "@/components/nav-user"
import { StoreSwitcher } from "@/components/store-switcher"
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
} from "@/components/ui/sidebar"
import { getSidebarMenu, type SidebarItem } from "@/config/sidebar-menu"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function AppSidebar({
  permissions = [],
  role,
  user,
  selectedStoreId,
}: {
  permissions?: string[]
  role?: string | null
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
  selectedStoreId?: string | null
}) {
  const t = useTranslations("sidebar")
  const pathname = usePathname()

  const sidebarMenu = getSidebarMenu(role, permissions)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex items-center justify-center group-data-[collapsible=icon]:pt-4">
        <Logo className="mt-4 h-auto w-40 fill-green-800 group-data-[collapsible=icon]:hidden dark:fill-emerald-500" />
        <LogoSmall className="mt-2 hidden h-auto w-5 fill-green-800 group-data-[collapsible=icon]:block dark:fill-emerald-500" />
      </SidebarHeader>
      <SidebarContent>
        {sidebarMenu.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{t(section.label)}</SidebarGroupLabel>
            {section.showStoreSwitcher && (
              <div className="px-0 pb-2">
                <StoreSwitcher
                  selectedStoreId={selectedStoreId ?? null}
                  role={role ?? null}
                />
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item: SidebarItem) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                      >
                        <Link href={item.url}>
                          <Icon />
                          <span>{t(item.label)}</span>
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
