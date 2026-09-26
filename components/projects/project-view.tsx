"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectContext } from "@/stores/use-project-context"
import { cn } from "cn"
import {
  ArrowLeft,
  ClipboardList,
  ListTodo,
  MapPin,
  Receipt,
  RefreshCw,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"

const statusColors: Record<string, string> = {
  active:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
}

interface ProjectViewProps {
  children: React.ReactNode
}

export function ProjectView({ children }: ProjectViewProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const { project, projectId } = useProjectContext()
  const basePath = `/app/proyectos/${projectId}`

  const tabs = [
    {
      href: basePath,
      label: t("projects.tasks.title"),
      icon: ListTodo,
      active: pathname === basePath,
    },
    {
      href: `${basePath}/rutinas`,
      label: t("projects.routines.title"),
      icon: RefreshCw,
      active: pathname === `${basePath}/rutinas`,
    },
    {
      href: `${basePath}/detalles`,
      label: t("projects.detail.tabs.details"),
      icon: ClipboardList,
      active: pathname === `${basePath}/detalles`,
    },
    {
      href: `${basePath}/personas`,
      label: t("projects.detail.tabs.people"),
      icon: Users,
      active: pathname === `${basePath}/personas`,
    },
    {
      href: `${basePath}/gastos`,
      label: t("projects.detail.tabs.expenses"),
      icon: Receipt,
      active: pathname === `${basePath}/gastos`,
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/app/proyectos" />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {project.location}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <Badge className={statusColors[project.status]}>
            {t(`projects.status.${project.status}`)}
          </Badge>
        </div>
      </div>

      <nav aria-label={project.name}>
        <div className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                  tab.active
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground"
                    : "text-foreground/60 dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {children}
    </div>
  )
}
