"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  Calendar,
  MapPin,
  Users,
  Wallet,
  ListTodo,
  ArrowRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { type Project, statusConfig } from "@/lib/project-config"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

type ProjectCardProps = {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations()
  const tc = useTranslations("category-names")
  const status = statusConfig[project.status]
  const spendPct = project.budget > 0
    ? Math.min(100, Math.round((project.expenses / project.budget) * 100))
    : 0
  const overBudget = project.budget > 0 && project.expenses > project.budget
  const taskPct =
    project.tasksTotal > 0
      ? Math.round((project.tasksCompleted / project.tasksTotal) * 100)
      : 0
  const tasksRemaining = project.tasksTotal - project.tasksCompleted
  const visibleCollaborators = project.collaborators.slice(0, 4)
  const extraCollaborators = project.collaborators.length - visibleCollaborators.length

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg">
      {/* Header */}
      <CardHeader className="gap-3 border-b bg-muted/30 py-5 [.border-b]:pb-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tc(project.category)}
          </span>
          <CardTitle className="text-lg leading-tight text-balance">{project.name}</CardTitle>
        </div>
        <CardDescription className="line-clamp-2 leading-relaxed">
          {project.description}
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={cn("gap-1.5 font-medium", status.className)}
          >
            <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
            {t(`projects.status.${project.status}`)}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 py-5">
        {/* Meta grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t('projects.card.start')}</dt>
              <dd className="truncate font-medium">{dateFmt.format(new Date(project.startDate))}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t('projects.card.end')}</dt>
              <dd className="truncate font-medium">{project.endDate ? dateFmt.format(new Date(project.endDate)) : '—'}</dd>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t('projects.card.location')}</dt>
              <dd className="truncate font-medium">{project.location || '—'}</dd>
            </div>
          </div>
        </dl>

        <Separator />

        {/* Budget */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Wallet className="size-4 text-muted-foreground" />
              {t('projects.card.budget')}
            </span>
            <span className={cn("tabular-nums", overBudget && "text-red-600 dark:text-red-400")}>
              {currency.format(project.expenses)}{" "}
              <span className="text-muted-foreground">/ {currency.format(project.budget)}</span>
            </span>
          </div>
          <Progress
            value={spendPct}
            className={cn(
              overBudget && "[&_[data-slot=progress-indicator]]:bg-red-500",
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t('projects.card.ofBudgetUsed', { pct: spendPct })}
            {overBudget && <span className="text-red-600 dark:text-red-400"> · {t('projects.card.overBudget')}</span>}
          </p>
        </div>

        <Separator />

        {/* Tasks */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ListTodo className="size-4 text-muted-foreground" />
              {t('projects.card.tasks')}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {t('projects.card.doneLeft', { done: project.tasksCompleted, left: tasksRemaining })}
            </span>
          </div>
          <Progress value={taskPct} />
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/30 py-4 [.border-t]:pt-4">
        {/* Collaborators */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visibleCollaborators.map((c) => (
              <Avatar key={c.id} className="size-7 border-2 border-background">
                <AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback>
              </Avatar>
            ))}
            {extraCollaborators > 0 && (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                +{extraCollaborators}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {project.collaborators.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button size="sm" asChild>
            <Link href={`/dashboard/projects/${project.id}`}>
              {t('projects.card.view')} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
