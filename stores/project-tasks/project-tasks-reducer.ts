import type {
  TaskPriorityDTO,
  TaskStatus,
  TaskWithCommentCountDTO,
} from "@/actions/schemas/task"
import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"

/**
 * Stable empty list for a task whose comments have never been loaded, so
 * unopened rows share one identity and never trigger a re-render.
 */
export const EMPTY_COMMENTS: TaskCommentWithAuthorDTO[] = []

export type ProjectTasksState = {
  tasks: TaskWithCommentCountDTO[]
  commentsByTask: Record<string, TaskCommentWithAuthorDTO[]>
}

export type ProjectTaskAction =
  | { type: "addTask"; task: TaskWithCommentCountDTO }
  | { type: "updateTask"; task: TaskWithCommentCountDTO }
  | {
      type: "replaceTempTask"
      tempId: string
      task: TaskWithCommentCountDTO
    }
  | { type: "deleteTask"; taskId: string }
  | { type: "updateTaskStatus"; taskId: string; status: TaskStatus }
  | {
      type: "updateTaskPriority"
      taskId: string
      priority: TaskPriorityDTO
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

/**
 * `commentCount` lives on the task row because `getTasks` seeds it, but every
 * comment mutation adjusts it in the *same* action. That keeps the count and
 * the comment list from drifting, and because a failed action is discarded as
 * a unit, a rejected comment also rolls its count back. Previously the panel
 * reported a delta through a callback after the server call, leaving a window
 * where the count disagreed with the list.
 */
function bumpCommentCount(
  tasks: TaskWithCommentCountDTO[],
  taskId: string,
  delta: number
): TaskWithCommentCountDTO[] {
  return tasks.map((t) =>
    t.id === taskId
      ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
      : t
  )
}

/** Reconciles the seeded count with an authoritative fetch. */
function setCommentCount(
  tasks: TaskWithCommentCountDTO[],
  taskId: string,
  count: number
): TaskWithCommentCountDTO[] {
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

    case "updateTaskStatus":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, status: action.status } : t
        ),
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
