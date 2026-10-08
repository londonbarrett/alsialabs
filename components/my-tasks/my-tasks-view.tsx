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
import type { MyTask } from "@/actions/tasks"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/lib/schemas/task"
import { useMyTasksActions } from "@/stores/my-tasks/use-my-tasks-actions"
import { useMyTasksState } from "@/stores/my-tasks/use-my-tasks-state"
import { ListTodo } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

interface MyTasksViewProps {
  currentUserId: string
  isSuperUser: boolean
}

export function MyTasksView({
  currentUserId,
  isSuperUser,
}: MyTasksViewProps) {
  const t = useTranslations()
  const { isLoading } = useLoadingIndicator()
  const { tasks } = useMyTasksState()
  const { updateTaskStatus } = useMyTasksActions()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasks) {
      const owner = task.projectOwnerName
        ? ` (${task.projectOwnerName})`
        : ""
      map.set(task.projectId, `${task.projectName}${owner}`)
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    )
  }, [tasks])

  /**
   * The store always holds the unfiltered set, so the projection — not a
   * network call — decides what is visible. That is what keeps a focus
   * refresh honest: a fresh seed is a valid base for any filter combination.
   */
  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (statusFilter === "all" || task.status === statusFilter) &&
          (projectFilter === "all" || task.projectId === projectFilter)
      ),
    [tasks, statusFilter, projectFilter]
  )

  function handleStatusFilterChange(value: string | null) {
    if (value) setStatusFilter(value)
  }

  function handleProjectFilterChange(value: string | null) {
    if (value) setProjectFilter(value)
  }

  function getTaskAllowedStatuses(task: MyTask) {
    if (isSuperUser || task.isOwner) return ALL_TASK_STATUSES
    if (task.status === "done" || task.status === "cancelled")
      return null
    if (task.assigneeId === currentUserId)
      return COLLABORATOR_TASK_STATUSES
    return null
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
          items={{
            all: t("myTasks.allStatuses"),
            ...Object.fromEntries(
              ALL_TASK_STATUSES.map((s) => [
                s,
                t(`projects.tasks.status.${s}`),
              ])
            ),
          }}
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
          items={{
            all: t("myTasks.allProjects"),
            ...Object.fromEntries(projects),
          }}
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
        tasks={visibleTasks}
        statuses={Object.fromEntries(
          visibleTasks.map((task) => [
            task.id,
            getTaskAllowedStatuses(task),
          ])
        )}
        isPending={isLoading}
        currentUserId={currentUserId}
        isSuperUser={isSuperUser}
        onStatusChange={(taskId, projectId, status) =>
          void updateTaskStatus(projectId, taskId, status)
        }
      />
    </div>
  )
}
