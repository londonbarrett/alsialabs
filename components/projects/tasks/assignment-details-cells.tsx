"use client"

import { Money } from "@/components/common/money"
import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { TableCell } from "@/components/ui/table"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { Save } from "lucide-react"
import { useTranslations } from "next-intl"
import { Fragment } from "react"
import { useAssignmentDetailsForm } from "./use-assignment-details-form"

interface AssignmentDetailsCellsProps {
  taskId: string
  assignmentId: string
  cost: string
  comment: string | null
  terminal: boolean
  canEdit: boolean
  /** Columns the comment cell spans after the cost column. */
  commentColSpan?: number
}

/**
 * The cost cell and the comment cell of one assignment row. On the Tasks
 * table the comment cell spans the three columns left after cost, holding a
 * growing input and a Save button; elsewhere it stays a single column.
 */
export function AssignmentDetailsCells({
  taskId,
  assignmentId,
  cost,
  comment,
  terminal,
  canEdit,
  commentColSpan = 1,
}: AssignmentDetailsCellsProps) {
  const t = useTranslations()
  const { projectId } = useProjectContextState()
  const { values, setField, isDirty, isSubmitting, save } =
    useAssignmentDetailsForm({
      projectId,
      taskId,
      assignmentId,
      cost,
      comment,
      terminal,
    })

  const costCell = (
    <TableCell className="text-center">
      {canEdit ? (
        <MoneyInput
          aria-label={t("common.cost")}
          className="h-8 w-[116px]"
          value={values.cost}
          onChange={(value) => setField("cost", value)}
        />
      ) : (
        <span className="text-sm tabular-nums">
          <Money value={cost} />
        </span>
      )}
    </TableCell>
  )

  const commentCell = (
    <TableCell className="px-10 text-center" colSpan={commentColSpan}>
      {canEdit ? (
        <div className="flex w-full items-center gap-2">
          <Input
            maxLength={2000}
            placeholder={t("common.comments")}
            aria-label={t("common.comments")}
            className="h-8 min-w-0 flex-1"
            value={values.comment}
            onChange={(event) => setField("comment", event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            aria-label={t("common.save")}
            onClick={() => void save()}
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <Save aria-hidden="true" />}
            {t("common.save")}
          </Button>
        </div>
      ) : comment ? (
        <span className="text-sm text-muted-foreground">{comment}</span>
      ) : null}
    </TableCell>
  )

  return (
    <Fragment>
      {costCell}
      {commentCell}
    </Fragment>
  )
}
