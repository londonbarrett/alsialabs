"use client"

import { Money } from "@/components/common/money"
import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { TableCell } from "@/components/ui/table"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { Save } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId } from "react"
import { useAssignmentDetailsForm } from "./use-assignment-details-form"

interface AssignmentDetailsCellsProps {
  taskId: string
  assignmentId: string
  cost: string
  comment: string | null
  terminal: boolean
  canEdit: boolean
}

/**
 * The single cell of one assignment row that owns cost, the labeled comment
 * input, and Save. It always renders exactly one `<td>`; the Save button is
 * wired through `save()` rather than a wrapping `<form>`.
 */
export function AssignmentDetailsCells({
  taskId,
  assignmentId,
  cost,
  comment,
  terminal,
  canEdit,
}: AssignmentDetailsCellsProps) {
  const t = useTranslations()
  const { projectId } = useProjectContextState()
  const commentId = useId()
  const { values, setField, isDirty, isSubmitting, save } =
    useAssignmentDetailsForm({
      projectId,
      taskId,
      assignmentId,
      cost,
      comment,
      terminal,
    })

  if (!canEdit) {
    return (
      <TableCell className="text-center">
        <span className="text-sm tabular-nums">
          <Money value={cost} />
        </span>
        {comment && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {comment}
          </span>
        )}
      </TableCell>
    )
  }

  return (
    <TableCell className="text-center">
      <div className="flex flex-col items-center gap-1">
        <MoneyInput
          aria-label={t("common.cost")}
          className="h-8 w-[116px]"
          value={values.cost}
          onChange={(value) => setField("cost", value)}
        />
        <Label htmlFor={commentId} className="text-xs text-muted-foreground">
          {t("projects.tasks.comment")}
        </Label>
        <div className="flex w-full items-center justify-center gap-2">
          <Input
            id={commentId}
            maxLength={2000}
            aria-label={t("projects.tasks.comment")}
            className="h-8 min-w-0 flex-1"
            value={values.comment}
            onChange={(event) => setField("comment", event.target.value)}
          />
          {isDirty && (
            <Button
              type="button"
              size="icon-sm"
              aria-label={t("common.saveChanges")}
              onClick={() => void save()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner /> : <Save />}
            </Button>
          )}
        </div>
      </div>
    </TableCell>
  )
}
