import {
  User,
  Settings,
  FolderKanban,
  BarChart3,
  Users,
  LifeBuoy,
  MessageSquare,
  Shield,
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

function commonSections(): SidebarSection[] {
  return [
    {
      label: 'User',
      items: [
        { label: 'Profile', icon: User, url: '/dashboard/profile' },
        { label: 'Settings', icon: Settings, url: '/dashboard#settings' },
      ],
    },
    {
      label: 'Auxiliary',
      items: [
        { label: 'Help', icon: LifeBuoy, url: '/dashboard#help' },
        { label: 'Support', icon: MessageSquare, url: '/dashboard#support' },
      ],
    },
  ]
}

function superSections(): SidebarSection[] {
  return [
    {
      label: 'Admin',
      items: [
        { label: 'Users', icon: Shield, url: '/dashboard/users' },
      ],
    },
    {
      label: 'Navigation',
      items: [
        { label: 'Clients', icon: Users, url: '/dashboard/clients' },
        { label: 'Sales', icon: FolderKanban, url: '/dashboard#sales' },
        { label: 'Reports', icon: BarChart3, url: '/dashboard#reports' },
      ],
    },
  ]
}

export function getSidebarMenu(role: string | null | undefined): SidebarSection[] {
  const sections: SidebarSection[] = []

  sections.push(...commonSections())

  if (role === 'super') {
    sections.splice(1, 0, ...superSections())
  }

  return sections
}
