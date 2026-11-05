import type {
  MyAssignmentDTO,
  TaskAssignmentDTO,
  TaskStatus,
} from "@/actions/tasks/schemas"
import type { TaskCommentWithAuthorDTO } from "@/actions/tasks/schemas"
import { isTerminalStatus } from "@/lib/util/project-roles"

/**
 * Stable empty list for a task whose comments have never been loaded, so
 * unopened rows share one identity and never trigger a re-render.
 */
export const EMPTY_COMMENTS: TaskCommentWithAuthorDTO[] = []

/**
 * `assignments` is the single list the server sent for the tab being shown —
 * either the open rows (active) or the terminal ones (past), never both.
 */
export type MyTasksState = {
  assignments: MyAssignmentDTO[]
  commentsByTask: Record<string, TaskCommentWithAuthorDTO[]>
}

export type MyTasksSeed = {
  assignments: MyAssignmentDTO[]
}

export type MyTaskAction =
  | {
      type: "updateAssignment"
      assignmentId: string
      status: TaskStatus
    }
  | {
      type: "insertNextAssignment"
      source: MyAssignmentDTO
      assignment: TaskAssignmentDTO
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
 * `commentCount` lives on the assignment row because `getMyTasks` seeds it, but
 * every comment mutation adjusts it in the *same* action. That keeps the count
 * and the comment list from drifting, and because a failed action is discarded
 * as a unit, a rejected comment also rolls its count back.
 */
function changeCommentCount(
  state: MyTasksState,
  taskId: string,
  update: (count: number) => number
): MyAssignmentDTO[] {
  return state.assignments.map((row) =>
    row.taskId === taskId
      ? { ...row, commentCount: Math.max(0, update(row.commentCount)) }
      : row
  )
}

export function myTasksReducer(
  state: MyTasksState,
  action: MyTaskAction
): MyTasksState {
  switch (action.type) {
    /**
     * The list holds one view's rows, so an assignment whose status turns
     * terminal leaves it immediately — it belongs to the past tab now, which
     * the next seed brings back. Anything still open stays put.
     */
    case "updateAssignment": {
      const current = state.assignments.find(
        (row) => row.assignmentId === action.assignmentId
      )
      if (!current) return state

      if (isTerminalStatus(action.status)) {
        return {
          ...state,
          assignments: state.assignments.filter(
            (row) => row.assignmentId !== action.assignmentId
          ),
        }
      }

      return {
        ...state,
        assignments: state.assignments.map((row) =>
          row.assignmentId === action.assignmentId
            ? { ...row, status: action.status }
            : row
        ),
      }
    }

    /**
     * The returned assignment is a bare assignment row, so it carries no
     * project display fields. They are copied from the occurrence it replaces
     * rather than looked up again: same task, same project, same person.
     * `commentCount` starts at 0 because the occurrence is new. The source row
     * rides along in the action because completing it already removed it from
     * the list.
     */
    case "insertNextAssignment": {
      const next: MyAssignmentDTO = {
        ...action.source,
        assignmentId: action.assignment.id,
        taskId: action.assignment.taskId,
        status: action.assignment.status,
        comment: action.assignment.comment,
        startDate: action.assignment.startDate,
        endDate: action.assignment.endDate,
        commentCount: 0,
      }

      return { ...state, assignments: [next, ...state.assignments] }
    }

    case "setComments":
      return {
        assignments: changeCommentCount(
          state,
          action.taskId,
          () => action.comments.length
        ),
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: action.comments,
        },
      }

    case "createComment":
      return {
        assignments: changeCommentCount(
          state,
          action.taskId,
          (count) => count + 1
        ),
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
        assignments: changeCommentCount(
          state,
          action.taskId,
          (count) => count - 1
        ),
        commentsByTask: {
          ...state.commentsByTask,
          [action.taskId]: (
            state.commentsByTask[action.taskId] ?? []
          ).filter((c) => c.id !== action.commentId),
        },
      }
  }
}
