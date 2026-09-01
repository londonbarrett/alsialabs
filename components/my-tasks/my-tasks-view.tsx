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
import { getMyTasks, updateTaskStatus } from "@/lib/actions/tasks"
import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/lib/schemas/task"
import { useActionError } from "@/lib/util/action-errors"
import { ListTodo } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

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
  const translateError = useActionError()
  const { start: showLoading, stop: hideLoading } =
    useLoadingIndicator()
  const [tasks, setTasks] = useState(initialTasks)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of initialTasks) {
      const owner = task.projectOwnerName
        ? ` (${task.projectOwnerName})`
        : ""
      map.set(task.projectId, `${task.projectName}${owner}`)
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    )
  }, [initialTasks])

  function applyFilters(newStatus: string, newProject: string) {
    startTransition(async () => {
      const result = await getMyTasks({
        statusFilter: newStatus === "all" ? undefined : newStatus,
        projectIdFilter: newProject === "all" ? undefined : newProject,
      })
      if (result.data) {
        setTasks(result.data)
      } else if (result.serverError) {
        toast.error(translateError(result.serverError.code))
      } else {
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
    status: TaskStatus
  ) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    )
    showLoading()
    try {
      const result = await updateTaskStatus({
        projectId,
        taskId,
        status,
      })
      if (result.serverError) {
        toast.error(translateError(result.serverError.code))
        applyFilters(statusFilter, projectFilter)
      } else {
        toast.success(t("projects.tasks.statusChanged"))
        const nextTask = (result.data as unknown as { nextTask?: Task })
          ?.nextTask
        if (nextTask) {
          const completed = tasks.find((task) => task.id === taskId)
          if (completed) {
            const matchesStatus =
              statusFilter === "all" || statusFilter === nextTask.status
            const matchesProject =
              projectFilter === "all" ||
              projectFilter === completed.projectId
            if (matchesStatus && matchesProject) {
              const mapped: MyTask = {
                ...nextTask,
                projectId: completed.projectId,
                projectName: completed.projectName,
                projectColor: completed.projectColor,
                projectOwnerName: completed.projectOwnerName,
                isOwner: completed.isOwner,
                assigneeName: completed.assigneeName,
                commentCount: 0,
              } as unknown as MyTask
              setTasks((prev) => [mapped, ...prev])
            }
          }
          toast.success(t("projects.routines.nextOccurrenceCreated"))
        }
      }
    } catch {
      toast.error(t("common.somethingWentWrong"))
      applyFilters(statusFilter, projectFilter)
    } finally {
      hideLoading()
    }
  }

  function getTaskAllowedStatuses(task: MyTask) {
    if (isSuperUser || task.isOwner) return ALL_TASK_STATUSES
    if (task.status === "done" || task.status === "cancelled")
      return null
    if (task.assigneeId === currentUserId)
      return COLLABORATOR_TASK_STATUSES
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
            {ALL_TASK_STATUSES.map((s) => (
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
        statuses={Object.fromEntries(
          tasks.map((task) => [task.id, getTaskAllowedStatuses(task)])
        )}
        isPending={isPending}
        currentUserId={currentUserId}
        isSuperUser={isSuperUser}
        onStatusChange={handleStatusChange}
        onCommentCountChange={handleCommentCountChange}
      />
    </div>
  )
}
