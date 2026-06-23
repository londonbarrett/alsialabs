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
      { label: 'Profile', icon: User, url: '/' },
      { label: 'Settings', icon: Settings, url: '/' },
    ],
  },
  navigation: {
    label: 'Navigation',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
      { label: 'Projects', icon: FolderKanban, url: '/' },
      { label: 'Calendar', icon: Calendar, url: '/' },
      { label: 'Reports', icon: BarChart3, url: '/' },
      { label: 'Clients', icon: Users, url: '/dashboard/clients' },
    ],
  },
  auxiliary: {
    label: 'Auxiliary',
    items: [
      { label: 'Help', icon: LifeBuoy, url: '/' },
      { label: 'Support', icon: MessageSquare, url: '/' },
    ],
  },
}
