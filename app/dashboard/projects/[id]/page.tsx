import { ProjectTasks } from "@/components/projects/project-tasks"
import { getProjectContext } from "@/lib/actions/project-context"
import { getProjectTasks } from "@/lib/actions/project-tasks"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectTasksPage({ params }: Props) {
  const { id } = await params
  const {
    session,
    project,
    owners,
    collaborators,
    permissions,
    isCurrentUserAdmin,
  } = await getProjectContext(id)

  const tasks = await getProjectTasks(id)

  const isOwner =
    owners.some((o) => o.userId === session.user.id) ||
    isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const isCollaborator =
    !isOwner && collaborators.some((c) => c.userId === session.user.id)

  return (
    <ProjectTasks
      initialTasks={tasks}
      projectId={project.id}
      projectName={project.name}
      canEdit={canEdit}
      isOwner={isOwner}
      isCollaborator={isCollaborator}
      currentUserId={session.user.id}
      permissions={permissions}
      projectMembers={[...owners, ...collaborators]}
    />
  )
}
