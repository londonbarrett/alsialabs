import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

type PageHeaderProps = {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children?: ReactNode
} & (
  | { section?: undefined; sectionHref?: undefined }
  | { section: string; sectionHref: string }
)

export function PageHeader({
  title,
  section,
  sectionHref,
  subtitle,
  icon: Icon,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <header className="flex flex-col gap-1">
        {section && (
          <Link
            href={sectionHref}
            data-slot="page-header-section"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {section}
          </Link>
        )}
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-6 text-muted-foreground" />}
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="hidden max-w-prose text-pretty text-muted-foreground md:block">
            {subtitle}
          </p>
        )}
      </header>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
