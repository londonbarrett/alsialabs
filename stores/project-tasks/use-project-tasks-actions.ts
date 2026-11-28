"use client"

import {
  HISTORY_PAGE_SIZE,
  type TaskAssignmentHistoryDTO,
  type TaskPriorityDTO,
  type TaskStatus,
  type TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import type { TaskCommentWithAuthorDTO } from "@/actions/tasks/schemas"
import {
  archiveTask as archiveTaskAction,
  createComment as createCommentAction,
  createTask as createTaskAction,
  deleteComment as deleteCommentAction,
  deleteTask as deleteTaskAction,
  getTaskAssignmentHistory,
  getTaskComments,
  unarchiveTask as unarchiveTaskAction,
  updateAssignment as updateAssignmentAction,
  updateAssignmentStatus as updateAssignmentStatusAction,
  updateComment as updateCommentAction,
  updateTask as updateTaskAction,
  updateTaskPriority as updateTaskPriorityAction,
} from "@/actions/tasks"
import type { TaskFormValues } from "@/components/projects/tasks/task-dialog"
import { useSettle } from "@/hooks/use-settle"
import { closedCostDelta, sumMoney } from "@/lib/costs/delta"
import type { SettleResult } from "@/lib/types"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"
import { useProjectTasksStore } from "./project-tasks-store"

function toTaskPayload(projectId: string, values: TaskFormValues) {
  return {
    projectId,
    name: values.name,
    cost: values.cost,
    description: values.description,
    priority: values.priority as TaskPriorityDTO,
    assigneeIds: values.assigneeIds,
    startDate: values.startDate,
    endDate: values.endDate,
    recurrence: values.recurrence,
    interval: values.interval,
    daysOfWeek: values.daysOfWeek,
    startTime: values.startTime,
    endTime: values.endTime,
  }
}

export function useProjectTasksActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useProjectTasksStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createTaskAction)
  const { executeAsync: executeUpdate } = useAction(updateTaskAction)
  const { executeAsync: executeDelete } = useAction(deleteTaskAction)
  const { executeAsync: executeStatus } = useAction(
    updateAssignmentStatusAction
  )
  const { executeAsync: executeAssignmentUpdate } = useAction(
    updateAssignmentAction
  )
  const { executeAsync: executePriority } = useAction(
    updateTaskPriorityAction
  )
  const { executeAsync: executeHistory } = useAction(
    getTaskAssignmentHistory
  )
  const { executeAsync: executeArchive } = useAction(archiveTaskAction)
  const { executeAsync: executeUnarchive } = useAction(
    unarchiveTaskAction
  )

  const loadAssignmentHistory = useCallback(
    async (
      projectId: string,
      taskId: string,
      offset: number,
      limit: number = HISTORY_PAGE_SIZE
    ): Promise<TaskAssignmentHistoryDTO | null> => {
      const result = await executeHistory({
        projectId,
        taskId,
        limit,
        offset,
      })
      return result.data ?? null
    },
    [executeHistory]
  )

  const loadComments = useCallback(
    async (projectId: string, taskId: string): Promise<void> => {
      try {
        const result = await getTaskComments({ projectId, taskId })
        const comments = result.data ?? []
        const id = store
          .getState()
          .pend({ type: "setComments", taskId, comments })
        store.getState().commit(id)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.somethingWentWrong")
        )
      }
    },
    [store, t]
  )

  async function createTask({
    projectId,
    values,
    optimisticTask,
  }: {
    projectId: string
    values: TaskFormValues
    optimisticTask: TaskWithAssignmentsDTO
  }) {
    const result = await run(
      { type: "addTask", task: optimisticTask },
      () => executeCreate(toTaskPayload(projectId, values)),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempTask",
                tempId: optimisticTask.id,
                task: {
                  ...r.data,
                  commentCount: optimisticTask.commentCount,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.taskCreated"))
  }

  async function updateTask({
    projectId,
    taskId,
    values,
    optimisticTask,
    unassignAs,
  }: {
    projectId: string
    taskId: string
    values: TaskFormValues
    optimisticTask: TaskWithAssignmentsDTO
    unassignAs?: Record<string, "done" | "cancelled">
  }) {
    const result = await run(
      { type: "updateTask", task: optimisticTask },
      () =>
        executeUpdate({
          ...toTaskPayload(projectId, values),
          taskId,
          unassignAs,
        }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempTask",
                tempId: optimisticTask.id,
                task: {
                  ...r.data,
                  commentCount: optimisticTask.commentCount,
                },
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.taskUpdated"))
  }

  async function deleteTask(projectId: string, taskId: string) {
    const result = await run({ type: "deleteTask", taskId }, () =>
      executeDelete({ projectId, taskId })
    )
    settle(result, t("projects.tasks.taskDeleted"))
  }

  async function archiveTask(
    projectId: string,
    taskId: string,
    closeAs: "done" | "cancelled"
  ) {
    // Archiving closes every open row, so each of their costs joins the
    // closed total the server will report for this task.
    const assignments =
      store
        .getState()
        .optimistic.tasks.find((task) => task.id === taskId)?.assignments ?? []
    const costDelta = sumMoney(
      assignments
        .filter((assignment) => !isTerminalStatus(assignment.status))
        .map((assignment) =>
          closedCostDelta(
            { cost: assignment.cost, terminal: false },
            { cost: assignment.cost, terminal: true }
          )
        )
    )

    const result = await run(
      {
        type: "setArchived",
        taskId,
        archived: true,
        closeAs,
        costDelta,
      },
      () => executeArchive({ projectId, taskId, closeAs })
    )
    settle(result, t("projects.tasks.taskArchived"))
  }

  async function unarchiveTask(projectId: string, taskId: string) {
    const result = await run(
      { type: "setArchived", taskId, archived: false },
      () => executeUnarchive({ projectId, taskId }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "setArchived",
                taskId,
                archived: false,
                spawned: r.data.spawned,
                // The spawned rows are open, so they add nothing to the
                // closed-only total.
                costDelta: 0,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.taskUnarchived"))
  }

  async function updateAssignmentStatus(
    projectId: string,
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) {
    const current = store
      .getState()
      .optimistic.tasks.find((task) => task.id === taskId)
      ?.assignments.find((a) => a.id === assignmentId)
    if (!current) return

    // Optimistic terminal-total delta: the server counts terminal rows
    // itself (closedCount), so the pend moves the total with the row
    // and the commit — which carries no delta — keeps that adjustment.
    // A rejected transition (repeating reopen) discards the whole pend.
    const wasTerminal = isTerminalStatus(current.status)
    const willBeTerminal = isTerminalStatus(status)
    const closedDelta =
      wasTerminal === willBeTerminal
        ? 0
        : wasTerminal
          ? -1
          : 1

    // Money follows the same closed-only rule: closing a row adds its cost,
    // reopening it takes the cost back. An open row's cost is not money yet.
    const costDelta = closedCostDelta(
      { cost: current.cost, terminal: wasTerminal },
      { cost: current.cost, terminal: willBeTerminal }
    )

    const result = await run(
      {
        type: "upsertAssignment",
        taskId,
        assignment: { ...current, status },
        closedDelta,
        costDelta,
      },
      () => executeStatus({ projectId, assignmentId, status }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "upsertAssignment",
                taskId,
                assignment: r.data.assignment,
                nextAssignment: r.data.nextAssignment,
                // The transition already moved the total on the pend, and
                // every spawned row is open — it adds nothing to a
                // closed-only total.
                costDelta: 0,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.statusChanged"))
    if (result?.data?.nextAssignment) {
      toast.success(t("projects.routines.nextOccurrenceCreated"))
    }
  }

  async function updateAssignment(
    projectId: string,
    taskId: string,
    assignmentId: string,
    cost: string,
    comment: string | null,
    previousCost: string,
    terminal: boolean = true
  ): Promise<SettleResult> {
    const nextCost = cost || "0"
    // The caller supplies the pre-edit cost because history-panel rows are
    // fetched, not necessarily store-backed — a lookup here would silently
    // no-op on those rows. The task's total is a server aggregate between
    // reseeds: move it by the difference now, keep that adjustment on commit
    // (which carries no fresh delta), and revert it with the pend on failure.
    // Only a closed row is money: an open row's cost is stored, not counted.
    const costDelta = closedCostDelta(
      { cost: previousCost || "0", terminal },
      { cost: nextCost, terminal }
    )
    const result = await run(
      {
        type: "setAssignmentDetails",
        taskId,
        assignmentId,
        cost: nextCost,
        comment,
        costDelta,
      },
      () =>
        executeAssignmentUpdate({
          projectId,
          taskId,
          assignmentId,
          cost: nextCost,
          // The action trims, caps at 2000 characters and stores "" as null.
          comment: comment ?? "",
        }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "setAssignmentDetails",
                taskId,
                assignmentId,
                cost: r.data.cost,
                comment: r.data.comment,
                costDelta: 0,
              }
            : undefined,
      }
    )
    return settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function updateTaskPriority(
    projectId: string,
    taskId: string,
    priority: TaskPriorityDTO
  ) {
    const result = await run(
      { type: "updateTaskPriority", taskId, priority },
      () => executePriority({ projectId, taskId, priority })
    )
    settle(result, t("projects.tasks.priorityChanged"))
  }

  async function createComment(
    projectId: string,
    taskId: string,
    content: string,
    authorId: string
  ) {
    const existing = store
      .getState()
      .optimistic.commentsByTask[taskId]?.find(
        (c) => c.authorId === authorId
      )

    const tempComment: TaskCommentWithAuthorDTO = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId,
      authorName: existing?.authorName ?? null,
      authorImage: existing?.authorImage ?? null,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await run(
      { type: "createComment", taskId, comment: tempComment },
      () => createCommentAction({ projectId, taskId, content }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTempComment" as const,
                taskId,
                tempId: tempComment.id,
                comment: r.data.comment,
              }
            : undefined,
      }
    )
    settle(result, t("projects.tasks.comments.commentAdded"))
  }

  async function updateComment(
    projectId: string,
    taskId: string,
    commentId: string,
    content: string
  ) {
    const result = await run(
      { type: "updateComment", taskId, commentId, content },
      () =>
        updateCommentAction({ projectId, commentId, taskId, content })
    )
    settle(result, t("projects.tasks.comments.commentUpdated"))
  }

  async function deleteComment(
    projectId: string,
    taskId: string,
    commentId: string
  ) {
    const result = await run(
      { type: "deleteComment", taskId, commentId },
      () => deleteCommentAction({ projectId, commentId, taskId })
    )
    settle(result, t("projects.tasks.comments.commentDeleted"))
  }

  return {
    loadComments,
    loadAssignmentHistory,
    createTask,
    updateTask,
    deleteTask,
    archiveTask,
    unarchiveTask,
    updateAssignmentStatus,
    updateAssignment,
    updateTaskPriority,
    createComment,
    updateComment,
    deleteComment,
  }
}
