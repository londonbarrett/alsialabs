'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useTranslations } from 'next-intl'

export function DashboardBreadcrumb() {
  const t = useTranslations('breadcrumb')
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{t('dashboard')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.flatMap((segment, i) => {
          const href = '/' + segments.slice(0, i + 1).join('/')
          const isLast = i === segments.length - 1
          const label = t.has(segment) ? t(segment) : segment.charAt(0).toUpperCase() + segment.slice(1)

          const items = [
            <BreadcrumbItem key={href}>
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={href}>{label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
          ]

          if (!isLast) {
            items.push(<BreadcrumbSeparator key={`sep-${i}`} />)
          }

          return items
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
