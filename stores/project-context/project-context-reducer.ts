import type {
  ProjectContextDTO,
  ProjectDetailDTO,
} from "@/actions/schemas/project"
import type {
  ProjectMemberDTO,
  ProjectOwnerDTO,
} from "@/actions/schemas/project-people"

export type ProjectContextAction =
  | { type: "patchProject"; patch: Partial<ProjectDetailDTO> }
  | { type: "addOwner"; member: ProjectOwnerDTO }
  | { type: "addCollaborator"; member: ProjectMemberDTO }
  | { type: "removeOwner"; userId: string }
  | { type: "removeCollaborator"; userId: string }

export function projectContextReducer(
  state: ProjectContextDTO,
  action: ProjectContextAction
): ProjectContextDTO {
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
