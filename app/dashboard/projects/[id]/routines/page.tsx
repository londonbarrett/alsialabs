import { RoutinesView } from "@/components/projects/routines/routines-view"
import { getProjectContext } from "@/lib/actions/project-context"
import { getProjectRoutines } from "@/lib/actions/routines"

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoutinesPage({ params }: Props) {
  const { id } = await params
  const {
    session,
    project,
    owners,
    collaborators,
    permissions,
    isCurrentUserAdmin,
  } = await getProjectContext(id)

  const routines = await getProjectRoutines(id)

  const isOwner =
    owners.some((o) => o.userId === session.user.id) ||
    isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")

  return (
    <RoutinesView
      initialRoutines={routines}
      projectId={project.id}
      canEdit={canEdit}
      isOwner={isOwner}
      permissions={permissions}
      projectMembers={[...owners, ...collaborators]}
    />
  )
}
