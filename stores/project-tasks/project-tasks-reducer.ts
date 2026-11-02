import type {
  TaskAssignmentDTO,
  TaskPriorityDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/schemas/task"
import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"
import { sortAssignments } from "@/lib/tasks/assignments"

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
      type: "upsertAssignment"
      taskId: string
      assignment: TaskAssignmentDTO
      nextAssignment?: TaskAssignmentDTO | null
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

          const withNext =
            action.nextAssignment &&
            !withAssignment.some(
              (a) => a.id === action.nextAssignment!.id
            )
              ? [...withAssignment, action.nextAssignment]
              : withAssignment

          return { ...task, assignments: sortAssignments(withNext) }
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
