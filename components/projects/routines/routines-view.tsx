"use client"

import { ActionMenu } from "@/components/common/action-menu"
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
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  createRoutine,
  deleteRoutine,
  updateRoutine,
} from "@/lib/actions/routines"
import type { Routine } from "@/lib/drizzle/schema"
import { Plus, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  memo,
  useCallback,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import { RoutineDialog } from "./routine-dialog"
import { RoutineScheduleSummary } from "./routine-schedule-summary"

export type RoutineWithAssignee = Routine & {
  assigneeName: string | null
}

type RoutineAction =
  | { type: "add"; routine: RoutineWithAssignee }
  | { type: "update"; routine: RoutineWithAssignee }
  | {
      type: "replaceTemp"
      tempId: string
      routine: RoutineWithAssignee
    }
  | { type: "delete"; routineId: string }
  | { type: "reset"; routines: RoutineWithAssignee[] }

function routineReducer(
  state: RoutineWithAssignee[],
  action: RoutineAction
): RoutineWithAssignee[] {
  switch (action.type) {
    case "add":
      return [action.routine, ...state]
    case "update":
      return state.map((r) =>
        r.id === action.routine.id ? action.routine : r
      )
    case "replaceTemp":
      return state.map((r) =>
        r.id === action.tempId ? action.routine : r
      )
    case "delete":
      return state.filter((r) => r.id !== action.routineId)
    case "reset":
      return action.routines
  }
}

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface RoutinesViewProps {
  initialRoutines: RoutineWithAssignee[]
  projectId: string
  canEdit: boolean
  isOwner: boolean
  permissions: string[]
  projectMembers: ProjectMember[]
}

export const RoutinesView = memo(function RoutinesView({
  initialRoutines,
  projectId,
  canEdit,
  isOwner,
  permissions,
  projectMembers,
}: RoutinesViewProps) {
  const t = useTranslations()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [routines, dispatch] = useReducer(
    routineReducer,
    initialRoutines
  )
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<
    RoutineWithAssignee | undefined
  >()

  const canMutate = useMemo(
    () =>
      isOwner && (canEdit || permissions.includes("projects:delete")),
    [isOwner, canEdit, permissions]
  )

  const handleRoutineSubmit = useCallback(
    async function handleRoutineSubmit(data: {
      name: string
      description: string
      cost: string
      recurrence: string
      interval: string
      daysOfWeek: string[]
      time: string
      startDate: string
      endDate: string
      assigneeId: string | null
    }) {
      const isEdit = !!editingRoutine
      setEditingRoutine(undefined)
      setDialogOpen(false)
      const recurrence = data.recurrence as Routine["recurrence"]
      const interval = Number(data.interval) || 1

      const optimistic: RoutineWithAssignee = {
        id: editingRoutine?.id ?? `temp-${Date.now()}`,
        projectId,
        name: data.name,
        description: data.description || null,
        cost: data.cost || null,
        recurrence,
        interval,
        daysOfWeek: data.daysOfWeek,
        time: data.time || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        assigneeId: data.assigneeId,
        assigneeName:
          projectMembers.find((m) => m.userId === data.assigneeId)
            ?.userName ??
          editingRoutine?.assigneeName ??
          null,
        createdAt: editingRoutine?.createdAt ?? new Date(),
        updatedAt: new Date(),
      }

      dispatch({
        type: isEdit ? "update" : "add",
        routine: optimistic,
      })

      startLoading()
      const payload = { ...data, recurrence, interval }
      const result = isEdit
        ? await updateRoutine(payload, editingRoutine!.id, projectId)
        : await createRoutine(payload, projectId)
      stopLoading()

      if (result.success && result.data) {
        const realRoutine: RoutineWithAssignee = {
          ...result.data,
          assigneeName: optimistic.assigneeName,
        }
        startTransition(() => {
          dispatch({
            type: "replaceTemp",
            tempId: optimistic.id,
            routine: realRoutine,
          })
        })
        toast.success(
          isEdit
            ? t("projects.routines.routineUpdated")
            : t("projects.routines.routineCreated")
        )
      } else {
        if (!isEdit) {
          startTransition(() => {
            dispatch({ type: "delete", routineId: optimistic.id })
          })
        }
        toast.error(result.error || t("common.somethingWentWrong"))
      }

      return result
    },
    [
      t,
      projectId,
      editingRoutine,
      projectMembers,
      dispatch,
      startLoading,
      stopLoading,
      startTransition,
    ]
  )

  const openNew = useCallback(function openNew() {
    setEditingRoutine(undefined)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback(function openEdit(
    routine: RoutineWithAssignee
  ) {
    setEditingRoutine(routine)
    setDialogOpen(true)
  }, [])

  const handleOpenChange = useCallback(function handleOpenChange(
    open: boolean
  ) {
    setDialogOpen(open)
    if (!open) setEditingRoutine(undefined)
  }, [])

  const handleDeleteRoutine = useCallback(
    async function handleDeleteRoutine(routineId: string) {
      dispatch({ type: "delete", routineId })
      startLoading()
      const result = await deleteRoutine(routineId, projectId)
      stopLoading()
      if (!result.success) {
        toast.error(result.error || t("common.somethingWentWrong"))
        startTransition(() => {
          dispatch({ type: "reset", routines: initialRoutines })
        })
      } else {
        toast.success(t("projects.routines.routineDeleted"))
      }
    },
    [
      t,
      projectId,
      initialRoutines,
      dispatch,
      startLoading,
      stopLoading,
      startTransition,
    ]
  )

  const getAssigneeName = useCallback(
    function getAssigneeName(routine: RoutineWithAssignee) {
      if (routine.assigneeName) return routine.assigneeName
      const member = projectMembers.find(
        (m) => m.userId === routine.assigneeId
      )
      return member?.userEmail ?? routine.assigneeId
    },
    [projectMembers]
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
                          canDelete={permissions.includes(
                            "projects:delete"
                          )}
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
        projectMembers={projectMembers}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={handleRoutineSubmit}
      />
    </Card>
  )
})
