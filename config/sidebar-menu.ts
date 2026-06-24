import {
  User,
  Settings,
  LayoutDashboard,
  FolderKanban,
  Calendar,
  BarChart3,
  Users,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'

export interface SidebarItem {
  label: string
  icon: LucideIcon
  url: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

export const sidebarMenu: Record<string, SidebarSection> = {
  user: {
    label: 'User',
    items: [
      { label: 'Profile', icon: User, url: '/dashboard#profile' },
      { label: 'Settings', icon: Settings, url: '/dashboard#settings' },
    ],
  },
  navigation: {
    label: 'Navigation',
    items: [
      { label: 'Clients', icon: Users, url: '/dashboard/clients' },
      { label: 'Sales', icon: FolderKanban, url: '/dashboard#sales' },
      { label: 'Reports', icon: BarChart3, url: '/dashboard#reports' },
    ],
  },
  auxiliary: {
    label: 'Auxiliary',
    items: [
      { label: 'Help', icon: LifeBuoy, url: '/dashboard#help' },
      { label: 'Support', icon: MessageSquare, url: '/dashboard#support' },
    ],
  },
}
