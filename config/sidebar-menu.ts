import {
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
  const sections: SidebarSection[] = []

  const navigationItems: SidebarItem[] = [
    { label: 'Clients', icon: Users, url: '/dashboard/clients', requiredPermission: 'clients:view' },
    { label: 'Products', icon: Package, url: '/dashboard/products', requiredPermission: 'products:view' },
    { label: 'Sales', icon: FolderKanban, url: '/dashboard/sales', requiredPermission: 'sales:view' },
    { label: 'Reports', icon: BarChart3, url: '/dashboard/reports', requiredPermission: 'reports:view' },
  ]

  const visible = navigationItems.filter((item) => {
    if (!item.requiredPermission) return true
    return permissions?.includes(item.requiredPermission) ?? false
  })

  if (visible.length > 0) {
    sections.push({ label: 'Navigation', items: visible })
  }

  sections.push({
    label: 'Auxiliary',
    items: [
      { label: 'Help', icon: LifeBuoy, url: '/dashboard#help' },
      { label: 'Support', icon: MessageSquare, url: '/dashboard#support' },
    ],
  })

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
    sections.splice(sections.length - 1, 0, ...superSections(permissions))
  }

  return sections.filter((section) => section.items.length > 0)
}
