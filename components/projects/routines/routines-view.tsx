"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  RoutineSubmitData,
  RoutineWithAssignee,
} from "@/lib/types"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useRoutinesActions } from "@/stores/routines/use-routines-actions"
import { useRoutinesState } from "@/stores/routines/use-routines-state"
import { Plus, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { memo, useCallback, useState } from "react"
import { RoutineDialog } from "./routine-dialog"
import { RoutineScheduleSummary } from "./routine-schedule-summary"

export const RoutinesView = memo(function RoutinesView() {
  const t = useTranslations()
  const { projectId, members, isOwner } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = isOwner && canEditProject
  const canDeleteProject = useHasPermission("projects:delete")
  const { routines } = useRoutinesState()
  const { createRoutine, updateRoutine, deleteRoutine } =
    useRoutinesActions()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<
    RoutineWithAssignee | undefined
  >()

  const canMutate = isOwner && (canEdit || canDeleteProject)

  const handleRoutineSubmit = useCallback(
    async (data: RoutineSubmitData) => {
      const editing = editingRoutine
      setEditingRoutine(undefined)
      setDialogOpen(false)
      if (editing) {
        await updateRoutine({
          data,
          projectId,
          members,
          editingRoutine: editing,
        })
      } else {
        await createRoutine({ data, projectId, members })
      }
    },
    [projectId, members, editingRoutine, createRoutine, updateRoutine]
  )

  const openNew = useCallback(() => {
    setEditingRoutine(undefined)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((routine: RoutineWithAssignee) => {
    setEditingRoutine(routine)
    setDialogOpen(true)
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingRoutine(undefined)
  }, [])

  const handleDeleteRoutine = useCallback(
    async (routineId: string) => {
      await deleteRoutine({ projectId, routineId })
    },
    [projectId, deleteRoutine]
  )

  const getAssigneeName = useCallback(
    (routine: RoutineWithAssignee) => {
      if (routine.assigneeName) return routine.assigneeName
      const member = members.find(
        (m) => m.userId === routine.assigneeId
      )
      return member?.userEmail ?? routine.assigneeId
    },
    [members]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("projects.routines.title")}
          </span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t("projects.routines.addRoutine")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {routines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("projects.routines.noRoutines")}
          </p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    {t("projects.routines.name")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("projects.routines.assignee")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("projects.routines.recurrenceLabel")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("projects.routines.cost")}
                  </TableHead>
                  {canMutate && (
                    <TableHead scope="col">
                      {t("projects.routines.actions")}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {routines.map((routine) => (
                  <TableRow key={routine.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{routine.name}</p>
                        {routine.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {routine.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {routine.assigneeId ? (
                        <span className="text-sm">
                          {getAssigneeName(routine)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("projects.routines.unassigned")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit">
                          {t(
                            `projects.routines.recurrence.${routine.recurrence}`
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          <RoutineScheduleSummary routine={routine} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {routine.cost ? (
                        <Money value={routine.cost} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <ActionMenu
                          entityName={routine.name}
                          onEdit={() => openEdit(routine)}
                          onDelete={() =>
                            handleDeleteRoutine(routine.id)
                          }
                          canEdit={canEdit}
                          canDelete={canDeleteProject}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RoutineDialog
        routine={editingRoutine}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={handleRoutineSubmit}
      />
    </Card>
  )
})
