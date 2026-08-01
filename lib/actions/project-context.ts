import { cache } from "react"
import {
  getProjectCollaborators,
  getProjectOwners,
} from "@/lib/actions/project-users"
import {
  getProjectById,
  type ProjectDetail,
} from "@/lib/actions/projects"
import {
  auth,
  getUserPermissions,
  hasPermission,
  isSuperUser,
} from "@/lib/auth"
import type { ProjectMember } from "@/lib/types"
import type { Session } from "next-auth"
import { forbidden, notFound } from "next/navigation"

export interface ProjectPageContext {
  project: ProjectDetail
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  permissions: string[]
  session: Session
  isCurrentUserAdmin: boolean
}

export const getProjectContext = cache(
  async (id: string): Promise<ProjectPageContext> => {
    const session = await auth()

    if (
      !session?.user?.id ||
      !(await hasPermission(session.user.id, "projects", "view"))
    ) {
      forbidden()
    }

    let project
    try {
      project = await getProjectById(id)
    } catch {
      notFound()
    }

    const [owners, collaborators, permissions] = await Promise.all([
      getProjectOwners(id),
      getProjectCollaborators(id),
      getUserPermissions(session.user.id),
    ])

    return {
      project,
      owners,
      collaborators,
      permissions,
      session,
      isCurrentUserAdmin: isSuperUser(session),
    }
  }
)
