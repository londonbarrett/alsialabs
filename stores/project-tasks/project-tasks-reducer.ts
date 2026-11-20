import type {
  TaskAssignmentDTO,
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import type { TaskCommentWithAuthorDTO } from "@/actions/tasks/schemas"
import { archivedWindow, sortAssignments } from "@/lib/tasks/assignments"
import { isTerminalStatus } from "@/lib/util/project-roles"

export const EMPTY_COMMENTS: TaskCommentWithAuthorDTO[] = []

export type ProjectTasksState = {
  tasks: TaskWithAssignmentsDTO[]
  commentsByTask: Record<string, TaskCommentWithAuthorDTO[]>
}

export type ProjectTaskAction =
  | { type: "addTask"; task: TaskWithAssignmentsDTO }
  | { type: "updateTask"; task: TaskWithAssignmentsDTO }
  | {
      type: "replaceTempTask"
      tempId: string
      task: TaskWithAssignmentsDTO
    }
  | { type: "deleteTask"; taskId: string }
  | {
      type: "updateTaskPriority"
      taskId: string
      priority: TaskPriorityDTO
    }
  | {
      type: "setArchived"
      taskId: string
      archived: boolean
      closeAs?: "done" | "cancelled"
      spawned?: TaskAssignmentDTO[]
      /** Archive only: the clock the task's dates move to, as the server does. */
      archivedAt?: Date
    }
  | {
      type: "upsertAssignment"
      taskId: string
      assignment: TaskAssignmentDTO
      nextAssignment?: TaskAssignmentDTO | null
      /**
       * Optimistic adjustment to the task's server-counted terminal
       * total (open→terminal +1, terminal→open −1). Supplied on the
       * pend only: the commit re-applies neither it nor a fresh count,
       * and a discard reverts it with the rest of the pend.
       */
      closedDelta?: number
    }
  | {
      type: "setComments"
      taskId: string
      comments: TaskCommentWithAuthorDTO[]
    }
  | {
      type: "createComment"
      taskId: string
      comment: TaskCommentWithAuthorDTO
    }
  | {
      type: "replaceTempComment"
      taskId: string
      tempId: string
      comment: TaskCommentWithAuthorDTO
    }
  | {
      type: "updateComment"
      taskId: string
      commentId: string
      content: string
    }
  | { type: "deleteComment"; taskId: string; commentId: string }

function bumpCommentCount(
  tasks: TaskWithAssignmentsDTO[],
  taskId: string,
  delta: number
): TaskWithAssignmentsDTO[] {
  return tasks.map((t) =>
    t.id === taskId
      ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
      : t
  )
}

function setCommentCount(
  tasks: TaskWithAssignmentsDTO[],
  taskId: string,
  count: number
): TaskWithAssignmentsDTO[] {
  return tasks.map((t) =>
    t.id === taskId ? { ...t, commentCount: count } : t
  )
}

function omitKey<T>(
  record: Record<string, T>,
  key: string
): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

export function projectTasksReducer(
  state: ProjectTasksState,
  action: ProjectTaskAction
): ProjectTasksState {
  switch (action.type) {
    case "addTask":
      return { ...state, tasks: [action.task, ...state.tasks] }

    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.task.id ? action.task : t
        ),
      }

    case "replaceTempTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.tempId ? action.task : t
        ),
      }

    case "deleteTask":
      return {
        tasks: state.tasks.filter((t) => t.id !== action.taskId),
        commentsByTask: omitKey(state.commentsByTask, action.taskId),
      }

    case "updateTaskPriority":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, priority: action.priority }
            : t
        ),
      }

    case "setArchived":
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task

          const closeAs = action.closeAs
          const spawned = action.spawned
          let assignments = task.assignments
          let closedDelta = 0

          // Archive mirrors archiveTaskRow: close every non-terminal row
          // with the chosen disposition and count them into the server's
          // terminal total. It never spawns; unarchive only appends the
          // rows the server actually spawned, so history is never deleted
          // or invented here.
          if (closeAs !== undefined) {
            closedDelta = assignments.filter(
              (a) => !isTerminalStatus(a.status)
            ).length
            assignments = assignments.map((a) =>
              isTerminalStatus(a.status) ? a : { ...a, status: closeAs }
            )
          }

          if (spawned !== undefined) {
            const present = new Set(assignments.map((a) => a.id))
            assignments = sortAssignments([
              ...assignments,
              ...spawned.filter((s) => !present.has(s.id)),
            ])
          }

          return {
            ...task,
            archived: action.archived,
            ...(action.archivedAt !== undefined
              ? archivedWindow(task, action.archivedAt)
              : {}),
            closedCount: Math.max(0, task.closedCount + closedDelta),
            assignments,
          }
        }),
      }

    case "upsertAssignment":
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task
          const withAssignment = task.assignments.some(
            (a) => a.id === action.assignment.id
          )
            ? task.assignments.map((a) =>
                a.id === action.assignment.id
                  ? action.assignment
                  : a
              )
            : [...task.assignments, action.assignment]

          const withClosedCount = {
            ...task,
            closedCount: Math.max(
              0,
              task.closedCount + (action.closedDelta ?? 0)
            ),
          }

          const next = action.nextAssignment
          if (!next) {
            return {
              ...withClosedCount,
              assignments: sortAssignments(withAssignment),
            }
          }

          const withoutSameUser = withAssignment.filter(
            (a) => a.userId !== next.userId || a.id === next.id
          )
          const withNext = withoutSameUser.some((a) => a.id === next.id)
            ? withoutSameUser
            : [...withoutSameUser, next]

          return {
            ...withClosedCount,
            assignments: sortAssignments(withNext),
          }
        }),
      }

    case "setComments":
      return {
        tasks: setCommentCount(
          state.tasks,
          action.taskId,
          action.comments.length
        ),
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: action.comments,
        },
      }

    case "createComment":
      return {
        tasks: bumpCommentCount(state.tasks, action.taskId, 1),
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: [
            ...(state.commentsByTask[action.taskId] ?? []),
            action.comment,
          ],
        },
      }

    case "replaceTempComment":
      return {
        ...state,
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: (
            state.commentsByTask[action.taskId] ?? []
          ).map((c) => (c.id === action.tempId ? action.comment : c)),
        },
      }

    case "updateComment":
      return {
        ...state,
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: (
            state.commentsByTask[action.taskId] ?? []
          ).map((c) =>
            c.id === action.commentId
              ? { ...c, content: action.content, updatedAt: new Date() }
              : c
          ),
        },
      }

    case "deleteComment":
      return {
        tasks: bumpCommentCount(state.tasks, action.taskId, -1),
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: (
            state.commentsByTask[action.taskId] ?? []
          ).filter((c) => c.id !== action.commentId),
        },
      }
  }
}
