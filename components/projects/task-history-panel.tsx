"use client"

import {
  HISTORY_PAGE_SIZE,
  type TaskAssignmentDTO,
} from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useState } from "react"
import { TaskAssignmentRows } from "./task-assignment-rows"

interface TaskHistoryPanelProps {
  taskId: string
  recurrence: "daily" | "weekly" | null
  shownIds: string[]
  historySignature: string
}

export function TaskHistoryPanel({
  taskId,
  recurrence,
  shownIds,
  historySignature,
}: TaskHistoryPanelProps) {
  const t = useTranslations()
  const { projectId, isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEditProject || canDeleteProject)
  const columnCount = canMutate ? 7 : 6
  const { loadAssignmentHistory } = useProjectTasksActions()
  const [displayed, setDisplayed] = useState<TaskAssignmentDTO[]>([])
  const [fetchedCount, setFetchedCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [seenSignature, setSeenSignature] = useState(historySignature)

  // A terminal-row change means history membership moved (a close, a
  // spawn's optimistic flip): restart the offset so the next page picks
  // up the new row. Displayed rows stay; the id-dedupe reconciles the
  // overlap on the following fetch. Render-phase adjustment — the
  // setState-in-effect rule forbids doing this in an effect.
  if (seenSignature !== historySignature) {
    setSeenSignature(historySignature)
    setFetchedCount(0)
    setHasMore(true)
  }

  const loadMore = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const page = await loadAssignmentHistory(
        projectId,
        taskId,
        fetchedCount
      )
      if (page) {
        setDisplayed((prev) => {
          const seen = new Set([
            ...shownIds,
            ...prev.map((assignment) => assignment.id),
          ])
          return [
            ...prev,
            ...page.assignments.filter(
              (assignment) => !seen.has(assignment.id)
            ),
          ]
        })
        setFetchedCount((count) => count + HISTORY_PAGE_SIZE)
        setHasMore(page.hasMore)
      }
    } catch {
      return
    } finally {
      setLoading(false)
    }
  }, [loadAssignmentHistory, projectId, taskId, fetchedCount, shownIds])

  if (recurrence === null) return null

  return (
    <Fragment>
      <TaskAssignmentRows
        taskId={taskId}
        assignments={displayed}
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
