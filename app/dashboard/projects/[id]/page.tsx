import { TasksCard } from "@/components/projects/tasks-card"
import { getProjectContext } from "@/lib/actions/project-context"
import { getTasks } from "@/lib/actions/tasks"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TasksPage({ params }: Props) {
  const { id } = await params
  const {
    session,
    project,
    owners,
    collaborators,
    permissions,
    isCurrentUserAdmin,
  } = await getProjectContext(id)

  const tasks = await getTasks(id)

  const isOwner =
    owners.some((o) => o.userId === session.user.id) ||
    isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const isCollaborator =
    !isOwner && collaborators.some((c) => c.userId === session.user.id)

  return (
    <TasksCard
      initialTasks={tasks}
      projectId={project.id}
      canEdit={canEdit}
      isOwner={isOwner}
      isCollaborator={isCollaborator}
      currentUserId={session.user.id}
      permissions={permissions}
      projectMembers={[...owners, ...collaborators]}
    />
  )
}
