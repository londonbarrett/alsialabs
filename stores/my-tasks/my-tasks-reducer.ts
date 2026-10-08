import type { MyTask } from "@/actions/tasks"
import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import type { TaskCommentWithAuthor } from "@/lib/types"

/**
 * Stable empty list for a task whose comments have never been loaded, so
 * unopened rows share one identity and never trigger a re-render.
 */
export const EMPTY_COMMENTS: TaskCommentWithAuthor[] = []

export type MyTasksState = {
  tasks: MyTask[]
  commentsByTask: Record<string, TaskCommentWithAuthor[]>
}

export type MyTaskAction =
  | { type: "updateTaskStatus"; taskId: string; status: TaskStatus }
  | { type: "addNextTask"; sourceTaskId: string; nextTask: Task }
  | {
      type: "setComments"
      taskId: string
      comments: TaskCommentWithAuthor[]
    }
  | {
      type: "createComment"
      taskId: string
      comment: TaskCommentWithAuthor
    }
  | {
      type: "replaceTempComment"
      taskId: string
      tempId: string
      comment: TaskCommentWithAuthor
    }
  | {
      type: "updateComment"
      taskId: string
      commentId: string
      content: string
    }
  | { type: "deleteComment"; taskId: string; commentId: string }

/**
 * `commentCount` lives on the task row because `getMyTasks` seeds it, but every
 * comment mutation adjusts it in the *same* action. That keeps the count and
 * the comment list from drifting, and because a failed action is discarded as a
 * unit, a rejected comment also rolls its count back. Previously the panel
 * reported a delta upward through `MyTasksList` after the server call, leaving
 * a window where the count disagreed with the list.
 */
function bumpCommentCount(
  tasks: MyTask[],
  taskId: string,
  delta: number
): MyTask[] {
  return tasks.map((t) =>
    t.id === taskId
      ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
      : t
  )
}

/** Reconciles the seeded count with an authoritative fetch. */
function setCommentCount(
  tasks: MyTask[],
  taskId: string,
  count: number
): MyTask[] {
  return tasks.map((t) =>
    t.id === taskId ? { ...t, commentCount: count } : t
  )
}

export function myTasksReducer(
  state: MyTasksState,
  action: MyTaskAction
): MyTasksState {
  switch (action.type) {
    case "updateTaskStatus":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, status: action.status } : t
        ),
      }

    /**
     * The returned row is a bare task row, so it carries no project display
     * fields. They are copied from the task it replaces rather than looked up
     * again: same project, same assignee. `commentCount` starts at 0 because
     * the occurrence is new and has no comments yet — the completed task keeps
     * its own count, which only status touched.
     */
    case "addNextTask": {
      const source = state.tasks.find(
        (t) => t.id === action.sourceTaskId
      )
      if (!source) return state
      return {
        ...state,
        tasks: [
          {
            ...action.nextTask,
            projectId: source.projectId,
            projectName: source.projectName,
            projectColor: source.projectColor,
            projectOwnerName: source.projectOwnerName,
            assigneeName: source.assigneeName,
            isOwner: source.isOwner,
            commentCount: 0,
          },
          ...state.tasks,
        ],
      }
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
