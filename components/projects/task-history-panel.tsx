"use client"

import {
  HISTORY_PAGE_SIZE,
  type TaskAssignmentDTO,
} from "@/actions/tasks/schemas"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { freshlyClosedRows, mergeClosedRows } from "@/lib/tasks/list"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { assignmentColumnCount } from "./assignment-columns"
import { TaskClosedAssignmentRows } from "./task-closed-assignment-rows"

interface TaskHistoryPanelProps {
  taskId: string
  recurrence: "daily" | "weekly" | null
  /**
   * Every terminal row of the task as the store holds it. A zero-open
   * task renders these from first paint (its initial block renders
   * nothing); on a mixed task they feed open→terminal absorption while
   * the task's old slim history stays behind fetch.
   */
  storeTerminal: TaskAssignmentDTO[]
  /**
   * Ids of the task's currently-open rows — what the previous render
   * saw as open, so a row crossing into terminal here is recognized as
   * a fresh transition to absorb.
   */
  openIds: string[]
  historySignature: string
}

// Stable empty scope for mixed tasks (old closed history stays behind
// fetch only): fetchHistory keys off zeroOpenScope, so the empty case
// must keep its identity across renders.
const NO_CLOSED_SCOPE: TaskAssignmentDTO[] = []

export function TaskHistoryPanel({
  taskId,
  recurrence,
  storeTerminal,
  openIds,
  historySignature,
}: TaskHistoryPanelProps) {
  const t = useTranslations()
  const { projectId, isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEditProject || canDeleteProject)
  const columnCount = assignmentColumnCount(canMutate)
  const { loadAssignmentHistory } = useProjectTasksActions()
  const [displayed, setDisplayed] = useState<TaskAssignmentDTO[]>([])
  // The previous render's open ids: a row that was open there and is
  // terminal in the store now is a fresh open→terminal transition.
  const [prevOpenIds, setPrevOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(openIds)
  )
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
  // `zeroOpenScope`) without a self-referencing dependency cycle.
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

  // What the closed region starts from besides fetched/absorbed rows:
  // a zero-open task's store rows render from first paint (its open
  // block renders nothing); a mixed task starts empty so its old
  // history arrives through fetch only.
  const zeroOpenScope =
    openIds.length === 0 ? storeTerminal : NO_CLOSED_SCOPE

  // Open→terminal absorption: the row is terminal in the store and was
  // open last render — copy it into displayed so the closed badge
  // renders at pend, in place, and keeps rendering after the spawn
  // commit drops the store row (the later auto-fetch dedupes against
  // the copy). Render-phase adjustment — the setState-in-effect rule
  // forbids doing this in an effect — and it converges because the
  // next render's displayedIds contains the absorbed rows.
  const displayedIds = new Set(displayed.map((row) => row.id))
  const freshlyClosed = freshlyClosedRows(
    prevOpenIds,
    storeTerminal,
    displayedIds
  )
  if (freshlyClosed.length > 0) {
    setDisplayed((prev) => [...prev, ...freshlyClosed])
  }
  // Advance after this render's absorption decision so the next render
  // sees the current open ids as "previous". A ref written in an
  // effect would read the same, but react-hooks/refs bans reading a
  // ref during render and set-state-in-effect bans writing state in an
  // effect — this guarded render-phase update is the lint-clean form:
  // the value only becomes visible on the next render, and once
  // advanced, prevOpenIds (open ids) is disjoint from storeTerminal
  // (terminal ids), so an absorbed row can never be re-computed.
  if (
    prevOpenIds.size !== openIds.length ||
    openIds.some((id) => !prevOpenIds.has(id))
  ) {
    setPrevOpenIds(new Set(openIds))
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
            ...zeroOpenScope.map((row) => row.id),
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
    [loadAssignmentHistory, projectId, taskId, zeroOpenScope]
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

  const closed = mergeClosedRows(zeroOpenScope, displayed)

  return (
    <Fragment>
      <TaskClosedAssignmentRows
        taskId={taskId}
        assignments={closed}
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
