import type { Project } from "@/lib/types"

export type ProjectsAction =
  | { type: "add"; project: Project }
  | { type: "replaceTemp"; tempId: string; project: Project }

let nextOptimisticId = 1

export function nextOptimisticProjectId(): string {
  return `optimistic-${nextOptimisticId++}`
}

export function projectsReducer(
  state: Project[],
  action: ProjectsAction
): Project[] {
  switch (action.type) {
    case "add":
      return [action.project, ...state]
    case "replaceTemp":
      return state.map((p) =>
        p.id === action.tempId ? action.project : p
      )
  }
}
