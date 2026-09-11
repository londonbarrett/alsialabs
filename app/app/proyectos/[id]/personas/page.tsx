import { ProjectPeople } from "@/components/projects/project-people"
import { getProjectContext } from "@/lib/actions/projects"
import { unwrapResponse } from "@/lib/util/unwrap"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPeoplePage({ params }: Props) {
  const { id } = await params
  const {
    session,
    project,
    owners,
    collaborators,
    isCurrentUserAdmin,
  } = unwrapResponse(await getProjectContext({ projectId: id }))

  const isPrimaryOwner = project.primaryOwnerId === session.user.id
  const isOwner =
    owners.some(
      (o: { userId: string }) => o.userId === session.user.id
    ) || isCurrentUserAdmin

  return (
    <ProjectPeople
      projectId={project.id}
      owners={owners}
      collaborators={collaborators}
      primaryOwnerId={project.primaryOwnerId}
      canManageUsers={isPrimaryOwner || isCurrentUserAdmin}
      isOwner={isOwner}
    />
  )
}
