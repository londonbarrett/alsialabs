import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children?: ReactNode
}

export function PageHeader({ title, subtitle, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-6 text-muted-foreground" />}
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="max-w-prose text-pretty text-muted-foreground">
            {subtitle}
          </p>
        )}
      </header>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
