"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { cn } from "cn"
import {
  ClipboardList,
  FolderKanban,
  ListTodo,
  MapPin,
  Receipt,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

interface ProjectViewProps {
  children: React.ReactNode
}

export function ProjectView({ children }: ProjectViewProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const { project, projectId } = useProjectContextState()
  const basePath = `/app/proyectos/${projectId}`

  const sections = [
    {
      value: "tasks",
      href: basePath,
      label: t("common.tasks"),
      icon: ListTodo,
    },
    {
      value: "details",
      href: `${basePath}/detalles`,
      label: t("common.details"),
      icon: ClipboardList,
    },
    {
      value: "people",
      href: `${basePath}/personas`,
      label: t("common.people"),
      icon: Users,
    },
    {
      value: "expenses",
      href: `${basePath}/gastos`,
      label: t("common.expenses"),
      icon: Receipt,
    },
  ]

  const currentSection =
    sections.find((section) => section.href === pathname) ?? sections[0]
  const CurrentIcon = currentSection.icon

  function handleSectionChange(value: string | null) {
    const section = sections.find((item) => item.value === value)
    if (section) router.push(section.href)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <div>
          <Link
            href="/app/proyectos"
            data-slot="page-header-section"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <FolderKanban className="size-3.5" />
            {t("nav.proyectos")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.location && (
            <p className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
              <MapPin className="h-3 w-3" />
              {project.location}
            </p>
          )}
        </div>
      </div>

      <nav aria-label={project.name} className="hidden md:block">
        <div className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.value}
                href={section.href}
                aria-current={section.href === pathname ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                  section.href === pathname
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground"
                    : "text-foreground/60 dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="md:hidden">
        <Select
          items={sections.map(({ value, label }) => ({ value, label }))}
          value={currentSection.value}
          onValueChange={handleSectionChange}
        >
          <SelectTrigger
            className="w-full justify-start gap-2"
            aria-label={t("projects.selectSection")}
          >
            <CurrentIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {sections.map((section) => (
                <SelectItem
                  key={section.value}
                  value={section.value}
                  className="py-2.5"
                >
                  <section.icon />
                  {section.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {children}
    </div>
  )
}
