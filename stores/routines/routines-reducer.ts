import type { RoutineWithAssigneeDTO } from "@/actions/schemas/routine"

export type RoutinesAction =
  | { type: "add"; routine: RoutineWithAssigneeDTO }
  | { type: "update"; routine: RoutineWithAssigneeDTO }
  | {
      type: "replaceTemp"
      tempId: string
      routine: RoutineWithAssigneeDTO
    }
  | { type: "delete"; routineId: string }

export function routinesReducer(
  state: RoutineWithAssigneeDTO[],
  action: RoutinesAction
): RoutineWithAssigneeDTO[] {
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
