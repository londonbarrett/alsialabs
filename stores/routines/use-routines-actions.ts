"use client"

import { useSettle } from "@/hooks/use-settle"
import {
  createRoutine as createRoutineAction,
  deleteRoutine as deleteRoutineAction,
  updateRoutine as updateRoutineAction,
} from "@/actions/routines"
import type { Routine } from "@/lib/drizzle/schema"
import type {
  ProjectMember,
  RoutineSubmitData,
  RoutineWithAssignee,
} from "@/lib/types"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useRoutinesStore } from "./routines-store"

interface SaveRoutineParams {
  data: RoutineSubmitData
  projectId: string
  members: ProjectMember[]
}

/** The form hands `recurrence`/`interval` over as plain strings. */
function routinePayload(data: RoutineSubmitData) {
  return {
    ...data,
    recurrence: data.recurrence as Routine["recurrence"],
    interval: Number(data.interval) || 1,
  }
}

function buildOptimisticRoutine({
  data,
  projectId,
  members,
  editingRoutine,
}: SaveRoutineParams & { editingRoutine?: RoutineWithAssignee }): RoutineWithAssignee {
  const { recurrence, interval } = routinePayload(data)
  return {
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
      members.find((m) => m.userId === data.assigneeId)?.userName ??
      editingRoutine?.assigneeName ??
      null,
    createdAt: editingRoutine?.createdAt ?? new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Every routine mutation, so `routines-view` never imports the server actions
 * directly. Runs through the routines store (`RoutinesProvider`).
 *
 * `projectId` and `members` are explicit parameters rather than read from a
 * context, so the store folder stays free of sibling-store imports.
 */
export function useRoutinesActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useRoutinesStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createRoutineAction)
  const { executeAsync: executeUpdate } = useAction(updateRoutineAction)
  const { executeAsync: executeDelete } = useAction(deleteRoutineAction)

  async function createRoutine({ data, projectId, members }: SaveRoutineParams) {
    const optimistic = buildOptimisticRoutine({ data, projectId, members })
    const result = await run(
      { type: "add", routine: optimistic },
      () => executeCreate({ ...routinePayload(data), projectId }),
      {
        // The mutations return the bare routine row, so carry the assignee
        // label the optimistic row already resolved.
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTemp" as const,
                tempId: optimistic.id,
                routine: {
                  ...r.data,
                  assigneeName: optimistic.assigneeName,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.routines.routineCreated"))
  }

  async function updateRoutine({
    data,
    projectId,
    members,
    editingRoutine,
  }: SaveRoutineParams & {
    editingRoutine: RoutineWithAssignee
  }) {
    const optimistic = buildOptimisticRoutine({
      data,
      projectId,
      members,
      editingRoutine,
    })
    const result = await run(
      { type: "update", routine: optimistic },
      () =>
        executeUpdate({
          ...routinePayload(data),
          routineId: editingRoutine.id,
          projectId,
        }),
      {
        // Same as create: the server row carries no assignee join.
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTemp" as const,
                tempId: optimistic.id,
                routine: {
                  ...r.data,
                  assigneeName: optimistic.assigneeName,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.routines.routineUpdated"))
  }

  async function deleteRoutine({
    projectId,
    routineId,
  }: {
    projectId: string
    routineId: string
  }) {
    const result = await run({ type: "delete", routineId }, () =>
      executeDelete({ projectId, routineId })
    )
    settle(result, t("projects.routines.routineDeleted"))
  }

  return { createRoutine, updateRoutine, deleteRoutine }
}
