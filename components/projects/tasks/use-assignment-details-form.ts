"use client"

import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

interface AssignmentDetailsValues {
  cost: string
  comment: string
}

/** Values the row has agreed are saved, used to gate prop adoption. */
type AcceptedBaseline = AssignmentDetailsValues

/**
 * The server reads a decimal(12,2) cost back as "150.00" when "150" was
 * written. Compare numerically so that formatting difference is not mistaken
 * for a genuinely new server value.
 */
function sameCost(a: string, b: string): boolean {
  if (a === b) return true
  const left = Number(a)
  const right = Number(b)
  return (
    a.trim() !== "" &&
    b.trim() !== "" &&
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    left === right
  )
}

function sameBaseline(a: AcceptedBaseline, b: AcceptedBaseline): boolean {
  return sameCost(a.cost, b.cost) && a.comment === b.comment
}

export interface UseAssignmentDetailsFormParams {
  projectId: string
  taskId: string
  assignmentId: string
  cost: string
  comment: string | null
  terminal: boolean
}

export interface UseAssignmentDetailsFormResult {
  values: AssignmentDetailsValues
  setField(name: "cost" | "comment", value: string): void
  isDirty: boolean
  isSubmitting: boolean
  save(): Promise<void>
}

/**
 * Owns the draft cost/note for one assignment row. The form is intentionally
 * not a `<form>` element: the fields live inside a table cell alongside other
 * row cells, so the caller wires the button to `save()` instead of a submit event.
 *
 * Server props are adopted only while the draft is clean and idle. `run()`
 * pends optimistically, so the row can re-render with the typed values before
 * the request settles; adopting those props unconditionally would erase the
 * manager's text when a failed save discards the pend. After a successful
 * save the accepted baseline moves to the submitted values, but a fetched
 * history row keeps its stale props forever — so props are ignored until they
 * actually advance to those saved values.
 */
export function useAssignmentDetailsForm({
  projectId,
  taskId,
  assignmentId,
  cost,
  comment,
  terminal,
}: UseAssignmentDetailsFormParams): UseAssignmentDetailsFormResult {
  const { updateAssignment } = useProjectTasksActions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    control,
    setValue,
    getValues,
    reset,
    formState: { isDirty },
  } = useForm<AssignmentDetailsValues>({
    defaultValues: { cost, comment: comment ?? "" },
  })
  const values = useWatch({ control }) as AssignmentDetailsValues

  const acceptedRef = useRef<AcceptedBaseline>({
    cost,
    comment: comment ?? "",
  })
  // Set on success when the row's props have not advanced yet; cleared once
  // they reach the saved values. While set, no prop may overwrite the form.
  const awaitingPropsRef = useRef(false)

  useEffect(() => {
    // The failed-save guard: `run()` discards its optimistic pend while the
    // draft stays dirty, so reverted props must never be adopted here.
    if (isDirty || isSubmitting) return

    const incoming = { cost, comment: comment ?? "" }
    if (awaitingPropsRef.current) {
      // The row has caught up to the values we saved; normal adoption resumes.
      if (sameBaseline(incoming, acceptedRef.current)) {
        awaitingPropsRef.current = false
      }
      return
    }
    if (sameBaseline(incoming, acceptedRef.current)) return
    acceptedRef.current = incoming
    reset(incoming)
  }, [cost, comment, isDirty, isSubmitting, reset])

  const setField = useCallback(
    (name: "cost" | "comment", value: string) => {
      setValue(name, value, { shouldDirty: true })
    },
    [setValue]
  )

  // An async event handler rather than `handleSubmit`: the inputs live inside
  // a table cell, and the local state drives the button's spinner.
  const save = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const submitted = getValues()
      const result = await updateAssignment(
        projectId,
        taskId,
        assignmentId,
        submitted.cost,
        submitted.comment,
        cost,
        terminal
      )
      if (result.success) {
        // A store-backed row pends the submitted values into its props before
        // this resolves; a fetched history row does not. Only the latter needs
        // to wait for props to catch up before adopting again.
        awaitingPropsRef.current = sameBaseline(
          { cost, comment: comment ?? "" },
          acceptedRef.current
        )
        acceptedRef.current = { ...submitted }
        reset(submitted)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isSubmitting,
    getValues,
    updateAssignment,
    projectId,
    taskId,
    assignmentId,
    cost,
    comment,
    terminal,
    reset,
  ])

  return { values, setField, isDirty, isSubmitting, save }
}
