'use client'

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from '@/components/theme-provider'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

export function NavUser({
  user,
}: {
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const initials = (user.name ?? user.email ?? '?').charAt(0).toUpperCase()

  const themes = ['light', 'dark', 'system'] as const
  const current = (themes as readonly string[]).includes(theme) ? (theme as typeof themes[number]) : 'system'
  const nextIndex = (themes.indexOf(current) + 1) % themes.length
  const nextTheme = themes[nextIndex]
  const labels: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }
  const icons: Record<string, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }
  const Icon = icons[current]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name ?? 'User'}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} referrerPolicy="no-referrer" />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name ?? 'User'}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(nextTheme)}>
              <Icon />
              <span className="flex-1">{labels[current]}</span>
              <span className="text-muted-foreground text-xs">→ {labels[nextTheme]}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ redirectTo: '/login' })}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
