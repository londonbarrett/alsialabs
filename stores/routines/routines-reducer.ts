import type { RoutineWithAssignee } from "@/lib/types"

export type RoutinesAction =
  | { type: "add"; routine: RoutineWithAssignee }
  | { type: "update"; routine: RoutineWithAssignee }
  | {
      type: "replaceTemp"
      tempId: string
      routine: RoutineWithAssignee
    }
  | { type: "delete"; routineId: string }

export function routinesReducer(
  state: RoutineWithAssignee[],
  action: RoutinesAction
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
  }
}
