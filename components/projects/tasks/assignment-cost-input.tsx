"use client"

import { MoneyInput } from "@/components/common/money-input"
import { useDebounced } from "@/hooks/use-debounced"
import { COST_DEBOUNCE_MS } from "@/lib/tasks/cost"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

interface AssignmentCostInputProps {
  taskId: string
  assignmentId: string
  value: string
}

/**
 * A single assignment's editable cost. Typing updates local state only; the
 * store mutation fires after the debounce so a burst of keystrokes becomes one
 * write. Every other path that changes the assignment (status spawns, a fresh
 * server seed) resyncs through `value`.
 */
export function AssignmentCostInput({
  taskId,
  assignmentId,
  value,
}: AssignmentCostInputProps) {
  const t = useTranslations()
  const { projectId } = useProjectContextState()
  const { updateAssignmentCost } = useProjectTasksActions()
  const [cost, setCost] = useState(value)
  // React's "adjust state when a prop changes" pattern: adopting a new server
  // value (a reseed, or a successor row replacing this one) resyncs local
  // edits without a cascading setState-in-effect render.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setCost(value)
  }

  const persist = useCallback(
    (next: string) => {
      // A cleared MoneyInput produces ""; store a real zero instead. The
      // current prop is the pre-edit cost: history-panel rows can be fetched
      // rather than store-backed, so the delta must not rely on a store lookup.
      void updateAssignmentCost(
        projectId,
        taskId,
        assignmentId,
        next || "0",
        value
      )
    },
    [updateAssignmentCost, projectId, taskId, assignmentId, value]
  )

  const persistDebounced = useDebounced(persist, COST_DEBOUNCE_MS)

  const handleChange = useCallback(
    (next: string) => {
      setCost(next)
      persistDebounced(next)
    },
    [persistDebounced]
  )

  return (
    <MoneyInput
      aria-label={t("common.cost")}
      className="h-8 w-24"
      value={cost}
      onChange={handleChange}
    />
  )
}
