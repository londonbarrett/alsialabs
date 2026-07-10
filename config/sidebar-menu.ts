import {
  FolderKanban,
  BarChart3,
  Users,
  Package,
  LifeBuoy,
  MessageSquare,
  Shield,
  ShieldCheck,
  FolderTree,
  type LucideIcon,
} from 'lucide-react'

export interface SidebarItem {
  label: string
  icon: LucideIcon
  url: string
  requiredPermission?: string | string[]
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

function hasPermission(item: SidebarItem, permissions?: string[]) {
  if (!item.requiredPermission) return true
  const required = Array.isArray(item.requiredPermission) ? item.requiredPermission : [item.requiredPermission]
  return required.some((p) => permissions?.includes(p) ?? false)
}

function commonSections(permissions?: string[]): SidebarSection[] {
  const sections: SidebarSection[] = []

  const navigationItems: SidebarItem[] = [
    { label: 'clients', icon: Users, url: '/dashboard/clients', requiredPermission: 'clients:view' },
    { label: 'products', icon: Package, url: '/dashboard/products', requiredPermission: 'products:view' },
    { label: 'projects', icon: FolderKanban, url: '/dashboard/projects', requiredPermission: 'projects:view' },
    { label: 'categories', icon: FolderTree, url: '/dashboard/categories', requiredPermission: 'categories:view' },
    { label: 'sales', icon: FolderKanban, url: '/dashboard/sales', requiredPermission: 'sales:view' },
    { label: 'reports', icon: BarChart3, url: '/dashboard/reports', requiredPermission: 'reports:view' },
  ]

  const visible = navigationItems.filter((item) => hasPermission(item, permissions))

  if (visible.length > 0) {
    sections.push({ label: 'navigation', items: visible })
  }

  sections.push({
    label: 'auxiliary',
    items: [
      { label: 'help', icon: LifeBuoy, url: '/dashboard#help' },
      { label: 'support', icon: MessageSquare, url: '/dashboard#support' },
    ],
  })

  return sections
}

function superSections(permissions?: string[]): SidebarSection[] {
  const items: SidebarItem[] = [
    { label: 'users', icon: Shield, url: '/dashboard/users' },
    { label: 'permissions', icon: ShieldCheck, url: '/dashboard/permissions', requiredPermission: 'permissions:manage' },
  ]

  const visible = items.filter((item) => hasPermission(item, permissions))

  if (visible.length === 0) return []

  return [{ label: 'admin', items: visible }]
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
