import {
  User,
  Settings,
  FolderKanban,
  BarChart3,
  Users,
  Package,
  LifeBuoy,
  MessageSquare,
  Shield,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface SidebarItem {
  label: string
  icon: LucideIcon
  url: string
  requiredPermission?: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

function commonSections(permissions?: string[]): SidebarSection[] {
  const sections: SidebarSection[] = [
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

  const navigationItems: SidebarItem[] = [
    { label: 'Clients', icon: Users, url: '/dashboard/clients', requiredPermission: 'clients:view' },
    { label: 'Products', icon: Package, url: '/dashboard/products', requiredPermission: 'products:view' },
    { label: 'Sales', icon: FolderKanban, url: '/dashboard#sales' },
    { label: 'Reports', icon: BarChart3, url: '/dashboard#reports' },
  ]

  const visible = navigationItems.filter((item) => {
    if (!item.requiredPermission) return true
    return permissions?.includes(item.requiredPermission) ?? false
  })

  if (visible.length > 0) {
    sections.splice(1, 0, { label: 'Navigation', items: visible })
  }

  return sections
}

function superSections(permissions?: string[]): SidebarSection[] {
  const items: SidebarItem[] = [
    { label: 'Users', icon: Shield, url: '/dashboard/users' },
    { label: 'Permissions', icon: ShieldCheck, url: '/dashboard/permissions', requiredPermission: 'permissions:manage' },
  ]

  const visible = items.filter((item) => {
    if (!item.requiredPermission) return true
    return permissions?.includes(item.requiredPermission) ?? false
  })

  if (visible.length === 0) return []

  return [{ label: 'Admin', items: visible }]
}

export function getSidebarMenu(
  role: string | null | undefined,
  permissions?: string[],
): SidebarSection[] {
  const sections = commonSections(permissions)

  if (role === 'super') {
    sections.splice(1, 0, ...superSections(permissions))
  }

  return sections.filter((section) => section.items.length > 0)
}
