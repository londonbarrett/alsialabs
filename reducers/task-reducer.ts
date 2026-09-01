import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/drizzle/schema"

export type TaskWithCommentCount = Task & {
  commentCount: number
  assigneeName: string | null
}

export type TaskAction<T extends Task> =
  | { type: "add"; task: T }
  | { type: "update"; task: T }
  | { type: "replaceTemp"; tempId: string; task: T }
  | { type: "delete"; taskId: string }
  | { type: "reset"; tasks: T[] }
  | { type: "updateStatus"; taskId: string; status: TaskStatus }
  | { type: "updatePriority"; taskId: string; priority: TaskPriority }
  | { type: "updateCommentCount"; taskId: string; delta: number }

export function taskReducer<T extends Task>(
  state: T[],
  action: TaskAction<T>
): T[] {
  switch (action.type) {
    case "add":
      return [action.task, ...state]
    case "update":
      return state.map((t) =>
        t.id === action.task.id ? action.task : t
      )
    case "replaceTemp":
      return state.map((t) =>
        t.id === action.tempId ? action.task : t
      )
    case "delete":
      return state.filter((t) => t.id !== action.taskId)
    case "reset":
      return action.tasks
    case "updateStatus":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, status: action.status } : t
      )
    case "updatePriority":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, priority: action.priority } : t
      )
    case "updateCommentCount":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              commentCount: Math.max(
                0,
                (t as unknown as TaskWithCommentCount).commentCount +
                  action.delta
              ),
            }
          : t
      )
  }
}
