import type { ProjectSummaryDTO } from "@/actions/schemas/project"

export type ProjectsAction =
  | { type: "add"; project: ProjectSummaryDTO }
  | { type: "replaceTemp"; tempId: string; project: ProjectSummaryDTO }

let nextOptimisticId = 1

export function nextOptimisticProjectId(): string {
  return `optimistic-${nextOptimisticId++}`
}

export function projectsReducer(
  state: ProjectSummaryDTO[],
  action: ProjectsAction
): ProjectSummaryDTO[] {
  switch (action.type) {
    case "add":
      return [action.project, ...state]
    case "replaceTemp":
      return state.map((p) =>
        p.id === action.tempId ? action.project : p
      )
  }
}
