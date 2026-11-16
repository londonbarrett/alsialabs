"use client"

import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { TaskAssignmentRows } from "./task-assignment-rows"

interface TaskHistoryPanelProps {
  taskId: string
}

export function TaskHistoryPanel({ taskId }: TaskHistoryPanelProps) {
  const t = useTranslations()
  const { projectId, isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEditProject || canDeleteProject)
  const columnCount = canMutate ? 7 : 6
  const { loadAssignmentHistory } = useProjectTasksActions()
  const [rows, setRows] = useState<TaskAssignmentDTO[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const startedRef = useRef(false)

  const loadPage = useCallback(
    async (offset: number): Promise<void> => {
      setLoading(true)
      try {
        const page = await loadAssignmentHistory(
          projectId,
          taskId,
          offset
        )
        if (page) {
          setRows((prev) =>
            offset === 0
              ? page.assignments
              : [...prev, ...page.assignments]
          )
          setHasMore(page.hasMore)
        }
      } catch {
        return
      } finally {
        setLoading(false)
      }
    },
    [loadAssignmentHistory, projectId, taskId]
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void loadPage(0)
  }, [loadPage])

  const loadMore = useCallback(() => {
    void loadPage(rows.length)
  }, [loadPage, rows.length])

  return (
    <Fragment>
      <TaskAssignmentRows
        taskId={taskId}
        assignments={rows}
        onStatusChange={() => {}}
        preserveOrder
      />
      {hasMore && (
        <TableRow>
          <TableCell colSpan={columnCount}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={loadMore}
            >
              {t("common.loadMore")}
            </Button>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
