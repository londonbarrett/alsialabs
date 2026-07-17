import {
  ArrowRight,
  Calendar,
  Crown,
  ListTodo,
  MapPin,
  Users,
  Wallet,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { type Project } from "@/lib/types"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: "Active",
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
    dot: "bg-green-500",
  },
  completed: {
    label: "Completed",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  archived: {
    label: "Archived",
    className:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    dot: "bg-gray-500",
  },
}

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
  const primaryOwner = project.owners.find(
    (o) => o.id === project.primaryOwnerId
  )
  const spendPct =
    project.budget > 0
      ? Math.min(
          100,
          Math.round((project.expenses / project.budget) * 100)
        )
      : 0
  const overBudget =
    project.budget > 0 && project.expenses > project.budget
  const taskPct =
    project.tasksTotal > 0
      ? Math.round((project.tasksCompleted / project.tasksTotal) * 100)
      : 0
  const tasksRemaining = project.tasksTotal - project.tasksCompleted

  const allPeople = [...project.owners, ...project.collaborators]
  const visiblePeople = allPeople.slice(0, 4)
  const extraPeople = allPeople.length - visiblePeople.length

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg">
      {/* Header */}
      <CardHeader className="gap-3 border-b bg-muted/30 py-5 [.border-b]:pb-5">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {tc(project.category)}
          </span>
          <CardTitle className="text-lg leading-tight text-balance">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="hover:underline"
            >
              {project.name}
            </Link>
          </CardTitle>
          {primaryOwner && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="size-3 text-amber-500" />
              <span>{primaryOwner.name}</span>
            </div>
          )}
        </div>
        <CardDescription className="line-clamp-2 leading-relaxed">
          {project.description}
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={cn("gap-1.5 font-medium", status.className)}
          >
            <span
              className={cn("size-1.5 rounded-full", status.dot)}
              aria-hidden
            />
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
              <dt className="text-xs text-muted-foreground">
                {t("projects.card.start")}
              </dt>
              <dd className="truncate font-medium">
                {dateFmt.format(new Date(project.startDate))}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                {t("projects.card.end")}
              </dt>
              <dd className="truncate font-medium">
                {project.endDate
                  ? dateFmt.format(new Date(project.endDate))
                  : "—"}
              </dd>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                {t("projects.card.location")}
              </dt>
              <dd className="truncate font-medium">
                {project.location || "—"}
              </dd>
            </div>
          </div>
        </dl>

        <Separator />

        {/* Budget */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Wallet className="size-4 text-muted-foreground" />
              {t("projects.card.budget")}
            </span>
            <span
              className={cn(
                "tabular-nums",
                overBudget && "text-red-600 dark:text-red-400"
              )}
            >
              {currency.format(project.expenses)}{" "}
              <span className="text-muted-foreground">
                / {currency.format(project.budget)}
              </span>
            </span>
          </div>
          <Progress
            value={spendPct}
            className={cn(
              overBudget &&
                "[&_[data-slot=progress-indicator]]:bg-red-500"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("projects.card.ofBudgetUsed", { pct: spendPct })}
            {overBudget && (
              <span className="text-red-600 dark:text-red-400">
                {" "}
                · {t("projects.card.overBudget")}
              </span>
            )}
          </p>
        </div>

        <Separator />

        {/* Tasks */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ListTodo className="size-4 text-muted-foreground" />
              {t("projects.card.tasks")}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {t("projects.card.doneLeft", {
                done: project.tasksCompleted,
                left: tasksRemaining,
              })}
            </span>
          </div>
          <Progress value={taskPct} />
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/30 py-4 [.border-t]:pt-4">
        {/* People (owners + collaborators) */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visiblePeople.map((p) => (
              <Avatar
                key={p.id}
                className="size-7 border-2 border-background"
              >
                <AvatarImage src={p.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraPeople > 0 && (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                +{extraPeople}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {allPeople.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button size="sm" asChild>
            <Link href={`/dashboard/projects/${project.id}`}>
              {t("projects.card.view")}{" "}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
