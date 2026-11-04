"use client"

import type {
  MyAssignmentDTO,
  MyTasksTab,
  TaskStatus,
} from "@/actions/schemas/task"
import {
  ALL_TASK_STATUSES,
  COLLABORATOR_TASK_STATUSES,
} from "@/actions/schemas/task"
import { PageHeader } from "@/components/common/page-header"
import { MyTasksList } from "@/components/my-tasks/my-tasks-list"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  canChangeAnyAssignment,
  isTerminalStatus,
} from "@/lib/util/project-roles"
import { useMyTasksActions } from "@/stores/my-tasks/use-my-tasks-actions"
import { useMyTasksState } from "@/stores/my-tasks/use-my-tasks-state"
import { ListTodo } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface MyTasksViewProps {
  currentUserId: string
  tab: MyTasksTab
}

function allowedStatuses(
  assignment: MyAssignmentDTO
): readonly TaskStatus[] | null {
  if (isTerminalStatus(assignment.status)) return null
  return canChangeAnyAssignment(assignment.role)
    ? ALL_TASK_STATUSES
    : COLLABORATOR_TASK_STATUSES
}

function statusesFor(assignments: MyAssignmentDTO[]) {
  return Object.fromEntries(
    assignments.map((assignment) => [
      assignment.assignmentId,
      allowedStatuses(assignment),
    ])
  )
}

export function MyTasksView({
  currentUserId,
  tab,
}: MyTasksViewProps) {
  const t = useTranslations()
  const router = useRouter()
  const { isLoading } = useLoadingIndicator()
  const { assignments } = useMyTasksState()
  const { updateAssignment } = useMyTasksActions()

  /**
   * Switching tabs navigates, so the server fetches only the view that will
   * be shown and the provider reseeds the list with it. The filter keeps the
   * stale slice from leaking into the other tab before the new one lands.
   */
  const handleTabChange = useCallback(
    (value: string | null) => {
      if (value !== "active" && value !== "past") return
      router.replace(
        value === "past" ? "/app/mis-tareas?view=past" : "/app/mis-tareas"
      )
    },
    [router]
  )

  const visible = useMemo(
    () =>
      assignments.filter((row) =>
        tab === "active"
          ? !isTerminalStatus(row.status)
          : isTerminalStatus(row.status)
      ),
    [assignments, tab]
  )

  const header = (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="active">{t("myTasks.active")}</TabsTrigger>
        <TabsTrigger value="past">{t("myTasks.past")}</TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title={t("nav.mis-tareas")}
        subtitle={t("myTasks.subtitle")}
        icon={ListTodo}
      />

      <MyTasksList
        header={header}
        emptyLabel={
          tab === "active" ? t("myTasks.noTasks") : t("myTasks.noPast")
        }
        assignments={visible}
        statuses={tab === "active" ? statusesFor(visible) : {}}
        isPending={isLoading}
        currentUserId={currentUserId}
        readOnly={tab === "past"}
        onStatusChange={(projectId, assignmentId, status) =>
          void updateAssignment(projectId, assignmentId, status)
        }
      />
    </div>
  )
}
