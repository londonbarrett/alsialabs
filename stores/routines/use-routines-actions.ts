"use client"

import { useSettle } from "@/hooks/use-settle"
import {
  createRoutine,
  deleteRoutine as deleteRoutineAction,
  updateRoutine,
} from "@/actions/routines"
import type { Routine } from "@/lib/drizzle/schema"
import type {
  ProjectMember,
  RoutineSubmitData,
  RoutineWithAssignee,
} from "@/lib/types"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useRoutinesStore } from "./routines-store"

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

  async function saveRoutine({
    data,
    projectId,
    members,
    editingRoutine,
  }: {
    data: RoutineSubmitData
    projectId: string
    members: ProjectMember[]
    editingRoutine?: RoutineWithAssignee
  }) {
    const isEdit = !!editingRoutine
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
        members.find((m) => m.userId === data.assigneeId)?.userName ??
        editingRoutine?.assigneeName ??
        null,
      createdAt: editingRoutine?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    const payload = { ...data, recurrence, interval }
    const result = await run(
      { type: isEdit ? "update" : "add", routine: optimistic },
      () =>
        isEdit
          ? updateRoutine(payload, editingRoutine!.id, projectId)
          : createRoutine(payload, projectId),
      {
        // The mutations return the bare routine row, so carry the assignee
        // label the optimistic row already resolved.
        commitAction: (r) =>
          r.success && r.data
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

    settle(
      result,
      isEdit
        ? t("projects.routines.routineUpdated")
        : t("projects.routines.routineCreated")
    )
  }

  async function deleteRoutine({
    projectId,
    routineId,
  }: {
    projectId: string
    routineId: string
  }) {
    const result = await run({ type: "delete", routineId }, () =>
      deleteRoutineAction(routineId, projectId)
    )
    settle(result, t("projects.routines.routineDeleted"))
  }

  return { saveRoutine, deleteRoutine }
}
