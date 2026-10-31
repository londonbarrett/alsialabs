import type {
  ProjectContextDTO,
  ProjectDetailDTO,
} from "@/actions/schemas/project"
import type { ProjectMemberRowDTO } from "@/actions/schemas/project-membership"

export type ProjectContextAction =
  | { type: "patchProject"; patch: Partial<ProjectDetailDTO> }
  | { type: "addMember"; member: ProjectMemberRowDTO }
  | { type: "removeMember"; userId: string }
  | {
      type: "setMemberRole"
      userId: string
      role: "admin" | "collaborator"
    }

function isProtectedMember(
  member: ProjectMemberRowDTO | undefined
): boolean {
  return !member || member.isPrimaryOwner || member.role === "owner"
}

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
    case "addMember": {
      if (action.member.role === "owner" || action.member.isPrimaryOwner) {
        return state
      }
      if (state.members.some((m) => m.userId === action.member.userId)) {
        return state
      }
      return { ...state, members: [...state.members, action.member] }
    }
    case "removeMember": {
      const target = state.members.find((m) => m.userId === action.userId)
      if (isProtectedMember(target)) return state
      return {
        ...state,
        members: state.members.filter((m) => m.userId !== action.userId),
      }
    }
    case "setMemberRole": {
      const target = state.members.find((m) => m.userId === action.userId)
      if (isProtectedMember(target)) return state
      return {
        ...state,
        members: state.members.map((m) =>
          m.userId === action.userId ? { ...m, role: action.role } : m
        ),
      }
    }
  }
}
