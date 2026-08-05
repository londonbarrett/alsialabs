"use client"

import { PageHeader } from "@/components/common/page-header"
import { MyTasksList } from "@/components/my-tasks/my-tasks-list"
import { taskStatusColors } from "@/components/projects/task-status-select"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type { MyTask } from "@/lib/actions/tasks"
import {
  getMyTasks,
  updateTaskStatus,
} from "@/lib/actions/tasks"
import { ListTodo } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

const allTaskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const

const collaboratorTaskStatuses = [
  "in_progress",
  "blocked",
  "in_review",
] as const

interface MyTasksViewProps {
  initialTasks: MyTask[]
  currentUserId: string
  isSuperUser: boolean
}

export function MyTasksView({
  initialTasks,
  currentUserId,
  isSuperUser,
}: MyTasksViewProps) {
  const t = useTranslations()
  const { start: showLoading, stop: hideLoading } =
    useLoadingIndicator()
  const [tasks, setTasks] = useState(initialTasks)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of initialTasks) {
      map.set(task.projectId, task.projectName)
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    )
  }, [initialTasks])

  function applyFilters(newStatus: string, newProject: string) {
    startTransition(async () => {
      try {
        const result = await getMyTasks(
          newStatus === "all" ? undefined : newStatus,
          newProject === "all" ? undefined : newProject
        )
        setTasks(result)
      } catch {
        toast.error(t("common.somethingWentWrong"))
      }
    })
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value)
    applyFilters(value, projectFilter)
  }

  function handleProjectFilterChange(value: string) {
    setProjectFilter(value)
    applyFilters(statusFilter, value)
  }

  async function handleStatusChange(
    taskId: string,
    projectId: string,
    status: string
  ) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: status as MyTask["status"] }
          : t
      )
    )
    showLoading()
    try {
      const result = await updateTaskStatus(taskId, projectId, status)
      if (!result.success) {
        toast.error(result.error || t("common.somethingWentWrong"))
        applyFilters(statusFilter, projectFilter)
      } else {
        toast.success(t("projects.tasks.statusChanged"))
      }
    } finally {
      hideLoading()
    }
  }

  function getTaskAllowedStatuses(task: MyTask) {
    if (isSuperUser || task.isOwner) return allTaskStatuses
    if (task.status === "done") return null
    if (task.assigneeId === currentUserId)
      return collaboratorTaskStatuses
    return null
  }

  function handleCommentCountChange(taskId: string, delta: number) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
          : t
      )
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title={t("myTasks.title")}
        subtitle={t("myTasks.subtitle")}
        icon={ListTodo}
      />

      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("myTasks.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("myTasks.allStatuses")}
            </SelectItem>
            {allTaskStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                <Badge className={taskStatusColors[s]}>
                  {t(`projects.tasks.status.${s}`)}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={projectFilter}
          onValueChange={handleProjectFilterChange}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("myTasks.allProjects")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("myTasks.allProjects")}
            </SelectItem>
            {projects.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MyTasksList
        tasks={tasks}
        isPending={isPending}
        currentUserId={currentUserId}
        isSuperUser={isSuperUser}
        getTaskAllowedStatuses={getTaskAllowedStatuses}
        onStatusChange={handleStatusChange}
        onCommentCountChange={handleCommentCountChange}
      />
    </div>
  )
}
