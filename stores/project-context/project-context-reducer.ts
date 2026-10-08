import type {
  ProjectContext,
  ProjectDetail,
  ProjectOwner,
} from "@/actions/projects"
import type { ProjectMember } from "@/lib/types"

export type ProjectContextAction =
  | { type: "patchProject"; patch: Partial<ProjectDetail> }
  | { type: "addOwner"; member: ProjectOwner }
  | { type: "addCollaborator"; member: ProjectMember }
  | { type: "removeOwner"; userId: string }
  | { type: "removeCollaborator"; userId: string }

export function projectContextReducer(
  state: ProjectContext,
  action: ProjectContextAction
): ProjectContext {
  switch (action.type) {
    case "patchProject":
      return {
        ...state,
        project: { ...state.project, ...action.patch },
      }
    case "addOwner":
      if (state.owners.some((o) => o.userId === action.member.userId))
        return state
      return { ...state, owners: [...state.owners, action.member] }
    case "addCollaborator":
      if (
        state.collaborators.some(
          (c) => c.userId === action.member.userId
        )
      )
        return state
      return {
        ...state,
        collaborators: [...state.collaborators, action.member],
      }
    case "removeOwner": {
      const owners = state.owners.filter(
        (o) => o.userId !== action.userId
      )
      if (owners.length === state.owners.length) return state
      return { ...state, owners }
    }
    case "removeCollaborator": {
      const collaborators = state.collaborators.filter(
        (c) => c.userId !== action.userId
      )
      if (collaborators.length === state.collaborators.length)
        return state
      return { ...state, collaborators }
    }
  }
}
