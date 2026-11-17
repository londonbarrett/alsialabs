"use client"

import {
  HISTORY_PAGE_SIZE,
  type TaskAssignmentDTO,
} from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { mergeClosedRows } from "@/lib/tasks/list"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { TaskAssignmentRows } from "./task-assignment-rows"

interface TaskHistoryPanelProps {
  taskId: string
  recurrence: "daily" | "weekly" | null
  /**
   * The store's terminal rows when the task has no open assignment —
   * for a zero-open task the initial block renders nothing, so the
   * panel owns those rows from the first paint. Empty while any
   * assignment is open: mixed tasks keep closed history behind fetch.
   */
  initialClosed: TaskAssignmentDTO[]
  historySignature: string
}

export function TaskHistoryPanel({
  taskId,
  recurrence,
  initialClosed,
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
  // Starts at the mount signature and advances in the effect below:
  // equal-to-ref means "no terminal-set change since mount (or since
  // the last fetch)", which is what keeps mount from fetching and lets
  // each fetch's resolve-time stale check see the current signature.
  const signatureRef = useRef(historySignature)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  // The in-flight fetch flushes a pending re-run through this ref so
  // the flush always calls the latest fetch closure (fresh
  // `initialClosed`) without a self-referencing dependency cycle.
  const fetchRef = useRef<(offset: number, signature: string) => Promise<void>>(
    async () => {}
  )

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

  const fetchHistory = useCallback(
    async (offset: number, signature: string): Promise<void> => {
      inFlightRef.current = true
      try {
        const page = await loadAssignmentHistory(projectId, taskId, offset)
        // Stale-response discard: a terminal-set change landed while
        // this request was in flight, so its snapshot predates the
        // current history — drop it whole, no state writes.
        if (signatureRef.current !== signature) return
        if (!page) return
        setDisplayed((prev) => {
          const seen = new Set([
            ...initialClosed.map((row) => row.id),
            ...prev.map((row) => row.id),
          ])
          return [
            ...prev,
            ...page.assignments.filter((row) => !seen.has(row.id)),
          ]
        })
        // Absolute (not a running sum): a double-applied fetch for the
        // same offset must land on the same offset, never skip a window.
        setFetchedCount(offset + HISTORY_PAGE_SIZE)
        setHasMore(page.hasMore)
      } catch {
        return
      } finally {
        inFlightRef.current = false
        if (pendingRef.current) {
          pendingRef.current = false
          // A signature change arrived mid-flight (a spawn's commit
          // after its optimistic flip): serialize by re-running the
          // first page for the final signature — never lost.
          void fetchRef.current(0, signatureRef.current)
        }
      }
    },
    [loadAssignmentHistory, projectId, taskId, initialClosed]
  )

  useEffect(() => {
    fetchRef.current = fetchHistory
  }, [fetchHistory])

  // Auto-fetch on terminal-set change (never on mount): a spawn's
  // commit drops the just-closed row from the store, so the only copy
  // of it is server history — fetch offset 0 the moment the signature
  // moves and merge it in, no Load More click required.
  useEffect(() => {
    if (recurrence === null) return
    if (historySignature === signatureRef.current) return
    signatureRef.current = historySignature
    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }
    void fetchHistory(0, historySignature)
  }, [historySignature, recurrence, fetchHistory])

  const loadMore = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      await fetchHistory(fetchedCount, signatureRef.current)
    } finally {
      setLoading(false)
    }
  }, [fetchHistory, fetchedCount])

  if (recurrence === null) return null

  const closed = mergeClosedRows(initialClosed, displayed)

  return (
    <Fragment>
      <TaskAssignmentRows
        taskId={taskId}
        assignments={closed}
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
